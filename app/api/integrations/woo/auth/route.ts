import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { encryptIntegrationSecret } from "@/lib/integrations/crypto"
import { hasIntegrationEncryptionKey } from "@/lib/integrations/crypto-key"
import { triggerIntegrationSyncBackground } from "@/lib/integrations/orchestrator"
import { validateWooApiKeys } from "@/lib/integrations/providers/woo.provider"
import { normalizeWooShopDomain } from "@/lib/integrations/woo-domain"
import { setSupplierLiveSyncFlag } from "@/lib/supplier-sync/sync-engine"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    shopDomain: z.string().min(1).max(500),
    consumerKey: z.string().min(8).max(200),
    consumerSecret: z.string().min(8).max(200),
  })
  .strict()

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!hasIntegrationEncryptionKey()) {
    return NextResponse.json(
      { error: "INTEGRATION_ENCRYPTION_KEY or ENCRYPTION_KEY required" },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shop URL or API keys" }, { status: 400 })
  }

  const shopDomain = normalizeWooShopDomain(parsed.data.shopDomain)
  if (!shopDomain) {
    return NextResponse.json(
      { error: "Invalid store URL — use https://your-store.com" },
      { status: 400 }
    )
  }

  const authResult = await validateWooApiKeys({
    shopDomain: parsed.data.shopDomain,
    consumerKey: parsed.data.consumerKey,
    consumerSecret: parsed.data.consumerSecret,
  })

  if ("error" in authResult) {
    console.log("[woo-sync]", {
      supplierId: session.user.id,
      shopDomain,
      result: "connect_failed",
    })
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  let accessTokenEncrypted: string
  try {
    accessTokenEncrypted = encryptIntegrationSecret(
      JSON.stringify({
        ck: parsed.data.consumerKey.trim(),
        cs: parsed.data.consumerSecret.trim(),
      })
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encryption failed"
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  const config = { shop: shopDomain, apiKeys: true }

  const integration = await prisma.supplierIntegration.upsert({
    where: {
      userId_platform_name: {
        userId: session.user.id,
        platform: "woocommerce",
        name: "main",
      },
    },
    create: {
      userId: session.user.id,
      platform: "woocommerce",
      provider: "WOOCOMMERCE",
      name: "main",
      shopDomain: authResult.shopDomain,
      accessTokenEncrypted,
      status: "CONNECTED",
      enabled: true,
      config,
    },
    update: {
      provider: "WOOCOMMERCE",
      shopDomain: authResult.shopDomain,
      accessTokenEncrypted,
      status: "CONNECTED",
      enabled: true,
      errorMessage: null,
      lastSyncError: null,
      config,
    },
  })

  await setSupplierLiveSyncFlag(session.user.id, true)
  triggerIntegrationSyncBackground(integration.id, session.user.id)

  console.log("[woo-sync]", {
    supplierId: session.user.id,
    integrationId: integration.id,
    shopDomain: authResult.shopDomain,
    result: "connected",
  })

  return NextResponse.json({
    success: true,
    integrationId: integration.id,
    shopDomain: authResult.shopDomain,
  })
}
