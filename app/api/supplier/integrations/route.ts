import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  maskIntegrationConfig,
  normalizeIntegrationName,
  normalizePlatform,
  newWebhookSecret,
  parseShopifyIntegrationConfig,
} from "@/lib/supplier-integration-config"
import { prisma } from "@/lib/prisma"
import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `${url.protocol}//${url.host}`

  const rows = await prisma.supplierIntegration.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      platform: true,
      name: true,
      enabled: true,
      config: true,
      lastSyncAt: true,
      lastSyncError: true,
      lastSyncSummary: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const integrations = rows.map((r) => ({
    ...r,
    config: maskIntegrationConfig(r.config),
    inboundUrl:
      r.platform === "webhook"
        ? `${base}/api/integrations/inbound/${r.id}`
        : null,
  }))

  return NextResponse.json({ integrations, appBaseUrl: base })
}

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const platform = normalizePlatform(body.platform)
  if (!platform) {
    return NextResponse.json(
      { error: "platform must be shopify or webhook" },
      { status: 400 }
    )
  }

  const name = normalizeIntegrationName(body.name)

  if (platform === "shopify") {
    const cfgIn = body.config
    if (!cfgIn || typeof cfgIn !== "object" || Array.isArray(cfgIn)) {
      return NextResponse.json({ error: "config object required" }, { status: 400 })
    }
    const merged = { ...(cfgIn as Record<string, unknown>) }
    const shopHost = normalizeShopifyAdminHost(
      typeof merged.shop === "string" ? merged.shop : ""
    )
    if (!shopHost) {
      return NextResponse.json(
        { error: "config.shop must be a myshopify.com store host" },
        { status: 400 }
      )
    }
    merged.shop = shopHost
    const parsed = parseShopifyIntegrationConfig(merged)
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid Shopify access token or shop" },
        { status: 400 }
      )
    }

    try {
      const row = await prisma.supplierIntegration.create({
        data: {
          userId: session.user.id,
          platform: "shopify",
          name,
          config: merged as object,
        },
        select: { id: true, platform: true, name: true, enabled: true, config: true },
      })
      return NextResponse.json({
        integration: {
          ...row,
          config: maskIntegrationConfig(row.config),
        },
      })
    } catch {
      return NextResponse.json(
        { error: "An integration with this name already exists for Shopify" },
        { status: 409 }
      )
    }
  }

  const webhookSecret =
    typeof body.webhookSecret === "string" && body.webhookSecret.trim().length >= 16
      ? body.webhookSecret.trim()
      : newWebhookSecret()

  try {
    const row = await prisma.supplierIntegration.create({
      data: {
        userId: session.user.id,
        platform: "webhook",
        name,
        config: { webhookSecret },
      },
      select: { id: true, platform: true, name: true, enabled: true, config: true },
    })
    const url = new URL(req.url)
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      `${url.protocol}//${url.host}`
    return NextResponse.json({
      integration: {
        ...row,
        config: maskIntegrationConfig(row.config),
        /** Shown once: full secret for Bearer auth (store it securely). */
        webhookSecretPlain: webhookSecret,
        inboundUrl: `${base}/api/integrations/inbound/${row.id}`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "An integration with this name already exists for webhook" },
      { status: 409 }
    )
  }
}
