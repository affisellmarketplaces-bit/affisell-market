import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { shopifyAdminFetchJson } from "@/lib/shopify-admin-fetch"
import { parseShopifyIntegrationConfig } from "@/lib/supplier-integration-config"
import { shopifyProductToImportRow } from "@/lib/shopify-sync-map"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** Preview mapped import rows (no DB writes) — “dry run” UX. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  const integration = await prisma.supplierIntegration.findFirst({
    where: { id, userId: session.user.id, platform: "shopify", enabled: true },
  })

  if (!integration) {
    return NextResponse.json(
      { error: "Shopify integration not found or disabled" },
      { status: 404 }
    )
  }

  const parsed = parseShopifyIntegrationConfig(integration.config)
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid saved Shopify credentials" },
      { status: 400 }
    )
  }

  const r = await shopifyAdminFetchJson({
    shopHost: parsed.shopHost,
    accessToken: parsed.accessToken,
    apiVersion: parsed.apiVersion,
    path: "products.json?limit=8",
  })

  if (!r.ok) {
    return NextResponse.json({ error: r.message }, { status: 502 })
  }

  const data = r.json as Record<string, unknown>
  const list = Array.isArray(data.products) ? data.products : []
  const mapped = list
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    )
    .map((p) => shopifyProductToImportRow(p, parsed.shopHost))

  return NextResponse.json({
    preview: mapped.map((row) => ({
      title: row.title,
      sku: row.sku,
      suggested_price: row.suggested_price,
      stock: row.stock,
      imageCount: Array.isArray(row.images) ? row.images.length : 0,
    })),
  })
}
