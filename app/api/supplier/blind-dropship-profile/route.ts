import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { sealBlindSecret } from "@/lib/blind-dropship-crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const putSchema = z.object({
  name: z.string().min(1).max(200),
  apiType: z.enum(["rest", "csv", "browser"]).default("rest"),
  apiEndpoint: z.string().url().max(2000).optional().nullable(),
  /** When omitted on update, existing encrypted key is kept. */
  apiKeyPlain: z.string().min(8).max(4000).optional(),
  billingType: z.enum(["card_per_order", "wallet"]).default("wallet"),
  isBlindDropship: z.boolean().optional(),
  /** Stored in config JSON (plain until next save — consider rotating). Used for inbound tracking HMAC. */
  webhookSecret: z.string().min(16).max(500).optional(),
  /** Optional Stripe Connect destination account for automatic COGS transfers (EUR). */
  stripeConnectAccountId: z.string().optional(),
  createOrderPath: z.string().max(500).optional(),
  inventoryPath: z.string().max(500).optional(),
})

/** Supplier-only: configure blind-dropship partner API (encrypted at rest). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const row = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: session.user.id },
    select: {
      id: true,
      name: true,
      apiType: true,
      apiEndpoint: true,
      billingType: true,
      isBlindDropship: true,
      config: true,
      lastStockSyncAt: true,
      lastStockError: true,
      updatedAt: true,
    },
  })
  if (!row) return NextResponse.json({ profile: null })
  const cfg = (row.config ?? {}) as Record<string, unknown>
  const safe = { ...cfg }
  if (typeof safe.webhookSecret === "string") safe.webhookSecret = `…${String(safe.webhookSecret).slice(-4)}`
  return NextResponse.json({ profile: { ...row, config: safe } })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const json = (await req.json().catch(() => null)) as unknown
  const parsed = putSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }
  const b = parsed.data

  const existing = await prisma.blindDropshipSupplier.findUnique({ where: { linkedUserId: session.user.id } })
  const nextConfig: Record<string, unknown> = {
    ...((existing?.config as Record<string, unknown>) ?? {}),
  }
  if (b.webhookSecret) nextConfig.webhookSecret = b.webhookSecret
  if (b.stripeConnectAccountId) nextConfig.stripeConnectAccountId = b.stripeConnectAccountId.trim()
  if (b.createOrderPath) nextConfig.createOrderPath = b.createOrderPath
  if (b.inventoryPath) nextConfig.inventoryPath = b.inventoryPath

  let apiKeyEncrypted: string
  if (existing) {
    if (b.apiKeyPlain) apiKeyEncrypted = sealBlindSecret(b.apiKeyPlain)
    else apiKeyEncrypted = existing.apiKeyEncrypted
  } else {
    if (!b.apiKeyPlain) {
      return NextResponse.json({ error: "apiKeyPlain is required when creating a new profile" }, { status: 400 })
    }
    apiKeyEncrypted = sealBlindSecret(b.apiKeyPlain)
  }

  const row = await prisma.blindDropshipSupplier.upsert({
    where: { linkedUserId: session.user.id },
    create: {
      linkedUserId: session.user.id,
      name: b.name,
      apiType: b.apiType,
      apiEndpoint: b.apiEndpoint ?? null,
      apiKeyEncrypted,
      billingType: b.billingType,
      isBlindDropship: b.isBlindDropship ?? true,
      config: nextConfig as Prisma.InputJsonValue,
    },
    update: {
      name: b.name,
      apiType: b.apiType,
      apiEndpoint: b.apiEndpoint ?? null,
      ...(b.apiKeyPlain ? { apiKeyEncrypted } : {}),
      billingType: b.billingType,
      ...(b.isBlindDropship != null ? { isBlindDropship: b.isBlindDropship } : {}),
      config: nextConfig as Prisma.InputJsonValue,
    },
  })

  const trackingUrl = new URL("/api/webhooks/supplier/tracking", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001")
  trackingUrl.searchParams.set("sid", row.id)

  return NextResponse.json({
    ok: true,
    id: row.id,
    trackingWebhookUrl: trackingUrl.toString(),
    hint: "Configure your partner system to POST JSON { supplier_order_id, tracking_number, tracking_carrier? } with header X-Signature: hex(sha256(rawBody, webhookSecret)).",
  })
}
