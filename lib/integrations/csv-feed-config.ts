/**
 * CSV / published Google Sheet feed — the no-OAuth, no-API-keys integration provider.
 * Any supplier who can export or publish a spreadsheet can keep Affisell in sync: paste
 * the CSV URL, confirm the auto-suggested column mapping, done.
 */

import type { CanonicalProduct } from "@/lib/integrations/types"

/** Matches `hintImportFieldMap`'s keys exactly, so its suggestion plugs straight into this config. */
export const CSV_FEED_FIELD_KEYS = [
  "title",
  "description",
  "price",
  "sku",
  "stock",
  "images",
  "category",
] as const

export type CsvFeedFieldKey = (typeof CSV_FEED_FIELD_KEYS)[number]

export type CsvFeedFieldMap = Partial<Record<CsvFeedFieldKey, string>>

export type CsvFeedConfig = {
  feedUrl: string
  fieldMap: CsvFeedFieldMap
}

export const CSV_FEED_MAX_BYTES = 8 * 1024 * 1024
export const CSV_FEED_FETCH_TIMEOUT_MS = 15_000
export const CSV_FEED_MAX_ROWS = 20_000

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** A usable mapping needs at least a title and a price column. */
export function csvFeedFieldMapIsComplete(fieldMap: CsvFeedFieldMap): boolean {
  return Boolean(fieldMap.title?.trim() && fieldMap.price?.trim())
}

export function parseCsvFeedConfig(config: unknown): CsvFeedConfig | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null
  const c = config as Record<string, unknown>
  const feedUrl = typeof c.feedUrl === "string" ? c.feedUrl.trim() : ""
  if (!feedUrl) return null
  const rawMap = c.fieldMap
  const fieldMap: CsvFeedFieldMap = {}
  if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) {
    for (const key of CSV_FEED_FIELD_KEYS) {
      const v = (rawMap as Record<string, unknown>)[key]
      if (typeof v === "string" && v.trim()) fieldMap[key] = v.trim()
    }
  }
  if (!csvFeedFieldMapIsComplete(fieldMap)) return null
  return { feedUrl, fieldMap }
}

function cell(row: Record<string, string>, fieldMap: CsvFeedFieldMap, key: CsvFeedFieldKey): string {
  const header = fieldMap[key]
  if (!header) return ""
  return (row[header] ?? "").trim()
}

/**
 * One CSV row → canonical product. Returns `null` for rows that can't be sold (no title,
 * no valid price) rather than throwing — a handful of bad rows shouldn't fail the whole feed.
 * `externalId` prefers the SKU column (stable identity across syncs); without one it falls
 * back to a slug of the title, which is stable unless the supplier renames the product.
 */
export function mapCsvRowToCanonical(
  row: Record<string, string>,
  fieldMap: CsvFeedFieldMap,
  rowIndex: number
): CanonicalProduct | null {
  const title = cell(row, fieldMap, "title")
  if (!title) return null

  const priceRaw = cell(row, fieldMap, "price").replace(/[^\d,.-]/g, "").replace(",", ".")
  const priceEur = Number(priceRaw)
  if (!Number.isFinite(priceEur) || priceEur <= 0) return null
  const priceCents = Math.round(priceEur * 100)

  const skuRaw = cell(row, fieldMap, "sku")
  const handle = slugify(title) || `row-${rowIndex}`
  const externalId = skuRaw || handle || `row-${rowIndex}`

  const stockRaw = cell(row, fieldMap, "stock").replace(",", ".")
  const stock = stockRaw ? Math.max(0, Math.round(Number(stockRaw) || 0)) : 0

  const imageUrl = cell(row, fieldMap, "images")
  const description = cell(row, fieldMap, "description") || title
  const category = cell(row, fieldMap, "category")

  return {
    externalId,
    title,
    descriptionHtml: description,
    handle,
    productType: category || undefined,
    priceCents,
    inventoryQuantity: stock,
    images: imageUrl ? [{ url: imageUrl }] : [],
    variants: [
      {
        externalId,
        sku: skuRaw || externalId,
        title,
        priceCents,
        inventory: stock,
      },
    ],
    options: [],
    raw: row,
  }
}

export function mapCsvRowsToCanonical(
  rows: Record<string, string>[],
  fieldMap: CsvFeedFieldMap
): CanonicalProduct[] {
  const out: CanonicalProduct[] = []
  const seen = new Set<string>()
  rows.slice(0, CSV_FEED_MAX_ROWS).forEach((row, index) => {
    const product = mapCsvRowToCanonical(row, fieldMap, index)
    if (!product) return
    /** Duplicate identities (two rows, same SKU/title) — keep the first, skip the rest. */
    if (seen.has(product.externalId)) return
    seen.add(product.externalId)
    out.push(product)
  })
  return out
}
