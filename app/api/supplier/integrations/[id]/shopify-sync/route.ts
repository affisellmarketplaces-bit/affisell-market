import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { shopifyAdminFetchJson } from "@/lib/shopify-admin-fetch"
import { parseShopifyIntegrationConfig } from "@/lib/supplier-integration-config"
import {
  executeSupplierProductsImport,
  SUPPLIER_IMPORT_MAX_BATCH,
} from "@/lib/supplier-products-import-exec"
import { shopifyProductToImportRow } from "@/lib/shopify-sync-map"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const MAX_PAGES = 4

export async function POST(_req: Request, ctx: Ctx) {
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

  let sinceId = 0
  const shopProducts: Record<string, unknown>[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const path = `products.json?limit=30&since_id=${sinceId}`
    const r = await shopifyAdminFetchJson({
      shopHost: parsed.shopHost,
      accessToken: parsed.accessToken,
      apiVersion: parsed.apiVersion,
      path,
    })

    if (!r.ok) {
      await prisma.supplierIntegration.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: r.message,
        },
      })
      return NextResponse.json({ error: r.message }, { status: 502 })
    }

    const data = r.json as Record<string, unknown>
    const list = Array.isArray(data.products) ? data.products : []
    if (list.length === 0) break

    for (const item of list) {
      if (item && typeof item === "object" && !Array.isArray(item))
        shopProducts.push(item as Record<string, unknown>)
    }

    const last = list[list.length - 1] as Record<string, unknown>
    const lid = Number(last.id)
    sinceId = Number.isFinite(lid) ? lid : sinceId + 1
    if (list.length < 30) break
  }

  const rows = shopProducts
    .map((p) => shopifyProductToImportRow(p, parsed.shopHost))
    .filter((row) => {
      const t = row.title
      return typeof t === "string" && t.trim().length > 0
    })

  if (rows.length === 0) {
    await prisma.supplierIntegration.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
        lastSyncSummary: { fetched: 0, created: 0, batches: 0 },
      },
    })
    return NextResponse.json({
      ok: true,
      summary: { fetched: 0, created: 0, batches: 0 },
      message: "No products returned from Shopify",
    })
  }

  let totalCreated = 0
  let lastError: string | null = null
  const batchCount = Math.ceil(rows.length / SUPPLIER_IMPORT_MAX_BATCH)

  for (let i = 0; i < rows.length; i += SUPPLIER_IMPORT_MAX_BATCH) {
    const batch = rows.slice(i, i + SUPPLIER_IMPORT_MAX_BATCH)
    const ex = await executeSupplierProductsImport({
      supplierId: session.user.id,
      productsRaw: batch,
      bodyDraft: true,
    })
    if (!ex.ok) {
      lastError = ex.error
      break
    }
    totalCreated += ex.createdCount
  }

  const summary = {
    fetched: rows.length,
    created: totalCreated,
    batches: batchCount,
  }

  await prisma.supplierIntegration.update({
    where: { id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: lastError,
      lastSyncSummary: summary as object,
    },
  })

  if (lastError) {
    return NextResponse.json(
      { error: lastError, summary },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, summary })
}
