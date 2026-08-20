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
import {
  integrationLiveConnected,
  loadSupplierIntegrationsForUser,
  parseIntegrationSyncSummary,
} from "@/lib/supplier/load-supplier-integrations"
import { loadIntegrationProductCounts } from "@/lib/integrations/product-counts"
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

  try {
    const { rows, schemaMode } = await loadSupplierIntegrationsForUser(session.user.id)

    const integrations = rows.map((r) => {
      const config = maskIntegrationConfig(r.config)
      return {
        id: r.id,
        platform: r.platform,
        name: r.name,
        enabled: r.enabled,
        config,
        shopDomain: "shopDomain" in r ? r.shopDomain : null,
        status: "status" in r ? r.status : null,
        lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
        lastSyncError: r.lastSyncError,
        syncStats: parseIntegrationSyncSummary(r.lastSyncSummary),
        inboundUrl:
          r.platform === "webhook" ? `${base}/api/integrations/inbound/${r.id}` : null,
        liveConnected: integrationLiveConnected({
          platform: r.platform,
          enabled: r.enabled,
          status: "status" in r ? r.status : null,
          config: r.config,
          shopDomain: "shopDomain" in r ? r.shopDomain : null,
        }),
        productCount: 0,
        decoupledProductCount: 0,
      }
    })

    if (rows.length > 0) {
      try {
        const counts = await loadIntegrationProductCounts(
          session.user.id,
          rows.map((r) => r.id)
        )
        for (const item of integrations) {
          const c = counts[item.id]
          if (c) {
            item.productCount = c.total
            item.decoupledProductCount = c.decoupled
          }
        }
      } catch {
        /* non-blocking */
      }
    }

    return NextResponse.json({ integrations, appBaseUrl: base, schemaMode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed"
    console.error("[api/supplier/integrations]", { userId: session.user.id, result: "error", error: msg })
    return NextResponse.json({ error: msg, integrations: [] }, { status: 503 })
  }
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
