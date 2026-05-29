import type { SupplierIntegration } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { shopifyAdminFetchJson } from "@/lib/shopify-admin-fetch"
import { parseShopifyIntegrationConfig } from "@/lib/supplier-integration-config"
import {
  executeSupplierProductsImport,
  SUPPLIER_IMPORT_MAX_BATCH,
} from "@/lib/supplier-products-import-exec"
import { shopifyProductToImportRow } from "@/lib/shopify-sync-map"

const MAX_PAGES = 20
const PAGE_SIZE = 50

export type ShopifySyncSummary = {
  fetched: number
  created: number
  updated: number
  batches: number
}

export async function fetchShopifyProductRows(
  parsed: { shopHost: string; accessToken: string; apiVersion?: string }
): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; message: string }> {
  let sinceId = 0
  const shopProducts: Record<string, unknown>[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const path = `products.json?limit=${PAGE_SIZE}&since_id=${sinceId}`
    const r = await shopifyAdminFetchJson({
      shopHost: parsed.shopHost,
      accessToken: parsed.accessToken,
      apiVersion: parsed.apiVersion,
      path,
    })

    if (!r.ok) {
      return { ok: false, message: r.message }
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
    if (list.length < PAGE_SIZE) break
  }

  const rows = shopProducts
    .map((p) => shopifyProductToImportRow(p, parsed.shopHost))
    .filter((row) => {
      const t = row.title
      return typeof t === "string" && t.trim().length > 0
    })

  return { ok: true, rows }
}

/** Import or update supplier catalog from a saved Shopify integration (idempotent SKU). */
export async function syncShopifyIntegrationRecord(
  integration: Pick<SupplierIntegration, "id" | "userId" | "config">,
  options?: { bodyDraft?: boolean }
): Promise<
  | { ok: true; summary: ShopifySyncSummary }
  | { ok: false; error: string; summary?: ShopifySyncSummary }
> {
  const parsed = parseShopifyIntegrationConfig(integration.config)
  if (!parsed) {
    return { ok: false, error: "Invalid saved Shopify credentials" }
  }

  const fetched = await fetchShopifyProductRows(parsed)
  if (!fetched.ok) {
    await prisma.supplierIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: fetched.message,
      },
    })
    return { ok: false, error: fetched.message }
  }

  const rows = fetched.rows
  if (rows.length === 0) {
    const summary: ShopifySyncSummary = { fetched: 0, created: 0, updated: 0, batches: 0 }
    await prisma.supplierIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
        lastSyncSummary: summary as object,
      },
    })
    return { ok: true, summary }
  }

  let totalCreated = 0
  let totalUpdated = 0
  let lastError: string | null = null
  const batchCount = Math.ceil(rows.length / SUPPLIER_IMPORT_MAX_BATCH)

  for (let i = 0; i < rows.length; i += SUPPLIER_IMPORT_MAX_BATCH) {
    const batch = rows.slice(i, i + SUPPLIER_IMPORT_MAX_BATCH)
    const ex = await executeSupplierProductsImport({
      supplierId: integration.userId,
      productsRaw: batch,
      bodyDraft: options?.bodyDraft ?? true,
      upsert: true,
    })
    if (!ex.ok) {
      lastError = ex.error
      break
    }
    totalCreated += ex.createdCount
    totalUpdated += ex.updatedCount ?? 0
  }

  const summary: ShopifySyncSummary = {
    fetched: rows.length,
    created: totalCreated,
    updated: totalUpdated,
    batches: batchCount,
  }

  await prisma.supplierIntegration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: lastError,
      lastSyncSummary: summary as object,
    },
  })

  if (lastError) {
    return { ok: false, error: lastError, summary }
  }

  console.log("[shopify-catalog-sync]", {
    integrationId: integration.id,
    supplierId: integration.userId,
    ...summary,
  })

  return { ok: true, summary }
}

export function isShopifyAutoSyncEnabled(config: unknown): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) return true
  const c = config as Record<string, unknown>
  if (c.autoSync === false) return false
  return true
}

/** Cron: sync all Shopify integrations with auto-sync enabled. */
export async function runShopifyAutoSyncCron(): Promise<{
  integrations: number
  results: Array<{ id: string; ok: boolean; summary?: ShopifySyncSummary; error?: string }>
}> {
  const rows = await prisma.supplierIntegration.findMany({
    where: { platform: "shopify", enabled: true },
    select: { id: true, userId: true, config: true },
  })

  const results: Array<{
    id: string
    ok: boolean
    summary?: ShopifySyncSummary
    error?: string
  }> = []

  for (const row of rows) {
    if (!isShopifyAutoSyncEnabled(row.config)) {
      results.push({ id: row.id, ok: true, summary: { fetched: 0, created: 0, updated: 0, batches: 0 } })
      continue
    }
    const out = await syncShopifyIntegrationRecord(row)
    if (out.ok) {
      results.push({ id: row.id, ok: true, summary: out.summary })
    } else {
      results.push({
        id: row.id,
        ok: false,
        error: out.error,
        ...(out.summary ? { summary: out.summary } : {}),
      })
    }
  }

  console.log("[cron.sync-shopify]", {
    integrations: rows.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  })

  return { integrations: rows.length, results }
}
