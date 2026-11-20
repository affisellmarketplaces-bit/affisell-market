/**
 * Stock-outs per VARIANT, and partial stock-outs (founder brief 2026-11-19 « Intelligence de stock par déclinaison »).
 * Pure, client-safe. A sufficient TOTAL must never hide a variant that runs out.
 *
 * Only variants whose quantity Affisell really holds are judged: the advanced SKU rows (`Product.variants.variantRows`,
 * the stock checkout decrements). A product whose variants live only in the `ProductVariant` table (`hasVariants`
 * without rows) is « non évaluable » as a whole — the total is NEVER split across variants.
 *
 * Orders meet their row through ONE identity (`variant-key.ts`): « Noir · M » on the order = « Noir / M » on the row.
 * An order whose label matches no row, or a row whose key is shared by two rows (ambiguous), is never guessed: the
 * ambiguous rows are « non évaluable » and unmatched orders are COUNTED APART (`unattributedUnits`), never spread.
 * Each variant reuses the product forecast (`forecastStockout`): same reservation rule (no double deduction), same
 * confidence and freshness rules — the confirmation is the sheet's (a product-level confirmation covers the figures of
 * the sheet as a whole; said in `confirmationScope`).
 *
 * Partial stock-out = a product still sellable in some variants while others are at 0. For each blocked variant:
 * its share of the units SOLD (observed, 90 days, among the units tied to a row), the number of shops showing the
 * product, how many resellers sold that variant (shown only from 2 — counts, never who), and the fix (the row's
 * quantity in the sheet). Never « ventes perdues »: no failed transaction is tied to a variant in Affisell's records.
 */
import { variantKeyFromOrderLabel, variantKeyFromRowName } from "@/lib/supplier-costs/variant-key"
import { forecastStockout, FORECAST_WINDOW_DAYS, type StockoutForecast } from "@/lib/supplier-catalog-health/stockout-forecast"

export const VARIANT_SHARE_WINDOW_DAYS = 90
/** A reseller count is shown only from this value (smaller counts are folded into « fewer than 2 »). */
export const MIN_RESELLERS_SHOWN = 2

export type VariantOrderFact = {
  variantLabel: string | null
  paidAt: Date
  quantity: number
  affiliateId: string | null
}

export type VariantProductInput = {
  productId: string
  productName: string
  liveListings: number
  hasVariants: boolean
  /** Raw `Product.variants` JSON. */
  variants: unknown
  /** Units reserved by paid, unshipped, not-closed orders, per order label. */
  reservedByLabel: ReadonlyArray<{ variantLabel: string | null; units: number }>
  reservedAlreadyDeducted: boolean
  /** Paid orders of the last VARIANT_SHARE_WINDOW_DAYS days. */
  orders: ReadonlyArray<VariantOrderFact>
  confirmedAt: Date | null
  unconfirmedMarker: boolean
  sheetUpdatedAt: Date | null
  leadTimeDays: number | null
  now: Date
}

export type VariantVerdict = {
  key: string | null
  label: string
  /** null = the row's key is shared by another row: nothing can be tied to it. */
  ambiguous: boolean
  declaredUnits: number | null
  available: boolean
  forecast: StockoutForecast | null
  /** Units sold in 90 days tied to this row, and their share of all units tied to a row (observed). */
  units90d: number
  salesSharePct: number | null
  /** Distinct resellers who sold this variant in 90 days — null below MIN_RESELLERS_SHOWN. */
  sellingResellers: number | null
  sellingResellersBelowThreshold: boolean
}

export type VariantProductVerdict = {
  productId: string
  productName: string
  liveListings: number
  mode: "rows" | "variants_not_tracked" | "no_variants"
  confirmationScope: "whole_sheet"
  variants: VariantVerdict[]
  /** Some variants at 0 while others sell: the product looks available, part of it is not. */
  partialStockout: boolean
  blockedVariants: number
  /** Variants (still available) whose cover is below the lead time. */
  variantsAtRisk: number
  /** Units sold in 90 days whose label matched no single row — counted apart, never spread. */
  unattributedUnits90d: number
}

const DAY = 86_400_000

function rawRows(variants: unknown): Array<{ name: string; stock: number | null }> {
  const rows = (variants as { variantRows?: unknown } | null)?.variantRows
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => {
      const n = Number(r.stock)
      return { name: typeof r.name === "string" ? r.name.trim() : "", stock: Number.isFinite(n) ? Math.max(0, Math.round(n)) : null }
    })
}

export function analyzeVariantStock(i: VariantProductInput): VariantProductVerdict {
  const base = {
    productId: i.productId,
    productName: i.productName,
    liveListings: i.liveListings,
    confirmationScope: "whole_sheet" as const,
  }
  const rows = rawRows(i.variants)
  if (rows.length === 0) {
    return {
      ...base,
      mode: i.hasVariants ? "variants_not_tracked" : "no_variants",
      variants: [],
      partialStockout: false,
      blockedVariants: 0,
      variantsAtRisk: 0,
      unattributedUnits90d: i.orders.reduce((s, o) => s + Math.max(1, Math.round(o.quantity || 1)), 0),
    }
  }

  const keys = rows.map((r) => variantKeyFromRowName(r.name))
  const keyCount = new Map<string, number>()
  for (const k of keys) if (k) keyCount.set(k, (keyCount.get(k) ?? 0) + 1)
  const usable = (k: string | null) => k !== null && keyCount.get(k) === 1

  const since30 = i.now.getTime() - FORECAST_WINDOW_DAYS * DAY
  const daily = new Map<string, number[]>()
  const units90 = new Map<string, number>()
  const resellers = new Map<string, Set<string>>()
  let unattributed = 0
  let attributedTotal = 0
  for (const o of i.orders) {
    const k = variantKeyFromOrderLabel(o.variantLabel)
    const q = Math.max(1, Math.round(o.quantity || 1))
    if (!k || !usable(k)) {
      unattributed += q
      continue
    }
    attributedTotal += q
    units90.set(k, (units90.get(k) ?? 0) + q)
    if (o.affiliateId) resellers.set(k, (resellers.get(k) ?? new Set()).add(o.affiliateId))
    const t = o.paidAt.getTime()
    if (t >= since30) {
      const idx = Math.min(FORECAST_WINDOW_DAYS - 1, Math.max(0, FORECAST_WINDOW_DAYS - 1 - Math.floor((i.now.getTime() - t) / DAY)))
      const arr = daily.get(k) ?? Array.from({ length: FORECAST_WINDOW_DAYS }, () => 0)
      arr[idx] += q
      daily.set(k, arr)
    }
  }
  const reserved = new Map<string, number>()
  for (const r of i.reservedByLabel) {
    const k = variantKeyFromOrderLabel(r.variantLabel)
    if (k && usable(k)) reserved.set(k, (reserved.get(k) ?? 0) + Math.max(0, r.units))
  }

  const variants: VariantVerdict[] = rows.map((r, idx) => {
    const key = keys[idx]!
    const ambiguous = !usable(key)
    const k = ambiguous ? null : key
    const u90 = k ? units90.get(k) ?? 0 : 0
    const nRes = k ? resellers.get(k)?.size ?? 0 : 0
    const forecast =
      ambiguous || r.stock === null
        ? null
        : forecastStockout({
            declaredUnits: r.stock,
            confirmedAt: i.confirmedAt,
            unconfirmedMarker: i.unconfirmedMarker,
            sheetUpdatedAt: i.sheetUpdatedAt,
            reservedUnits: reserved.get(k!) ?? 0,
            reservedAlreadyDeducted: i.reservedAlreadyDeducted,
            dailyUnits: daily.get(k!) ?? Array.from({ length: FORECAST_WINDOW_DAYS }, () => 0),
            leadTimeDays: i.leadTimeDays,
            now: i.now,
          })
    const availableUnits = forecast?.calculation.availableUnits ?? r.stock
    return {
      key: k,
      label: r.name || "—",
      ambiguous,
      declaredUnits: r.stock,
      available: (availableUnits ?? 0) > 0,
      forecast,
      units90d: u90,
      salesSharePct: k && attributedTotal > 0 ? Math.round((u90 / attributedTotal) * 100) : null,
      sellingResellers: nRes >= MIN_RESELLERS_SHOWN ? nRes : null,
      sellingResellersBelowThreshold: nRes > 0 && nRes < MIN_RESELLERS_SHOWN,
    }
  })
  const judged = variants.filter((v) => !v.ambiguous && v.declaredUnits !== null)
  const blocked = judged.filter((v) => !v.available)
  const stillSelling = judged.filter((v) => v.available)
  const atRisk = stillSelling.filter((v) => v.forecast && (v.forecast.risk === "sous_le_delai" || v.forecast.risk === "probable"))
  return {
    ...base,
    mode: "rows",
    variants: variants.sort(
      (a, b) => Number(a.available) - Number(b.available) || (b.salesSharePct ?? -1) - (a.salesSharePct ?? -1) || a.label.localeCompare(b.label)
    ),
    partialStockout: blocked.length > 0 && stillSelling.length > 0,
    blockedVariants: blocked.length,
    variantsAtRisk: atRisk.length,
    unattributedUnits90d: unattributed,
  }
}

/** What the supplier should see first: partial stock-outs, then variants at risk; products with nothing to say are left out. */
export function variantStockWorthShowing(v: VariantProductVerdict): boolean {
  // A product whose variants Affisell does not track is shown only when it sells: the limit then matters.
  return v.mode === "variants_not_tracked" ? v.unattributedUnits90d > 0 : v.partialStockout || v.variantsAtRisk > 0
}

// ---------------------------------------------------------------------------------------------------------------
// Daily bell (founder brief 2026-11-19 §1): partial stock-outs and variants at risk join the supplier's ONE bell.
// ---------------------------------------------------------------------------------------------------------------

/** Same window as the product-level preventive alert: one notice per product and per 14 days at most. */
export const VARIANT_ALERT_WINDOW_DAYS = 14
/** Labels quoted in a bell (the page lists them all). */
export const VARIANT_ALERT_MAX_LABELS = 3

export type VariantNotice = {
  /** Sold-out variants that sold in the last 90 days (observed) — a size nobody ever bought is shown on the page, never rung. */
  soldOut: VariantVerdict[]
  /** Still-available variants whose cover is below the lead time (estimate). */
  atRisk: VariantVerdict[]
  /** Variants still on sale — the supplier must see what is still available, not only what is missing. */
  stillAvailable: number
}

/**
 * Is this product worth a bell for its VARIANTS? Only variants Affisell really holds (`mode: rows`), and only when it
 * says something the supplier can act on: a variant that SOLD is sold out while others still sell (partial stock-out),
 * or a still-available variant runs out before the lead time. A product already rung as blocked or at risk as a whole
 * is excluded by the caller (one product = one line of the bell).
 */
export function variantNoticeFor(v: VariantProductVerdict): VariantNotice | null {
  if (v.mode !== "rows") return null
  const judged = v.variants.filter((x) => !x.ambiguous && x.declaredUnits !== null)
  const stillAvailable = judged.filter((x) => x.available)
  const soldOut = v.partialStockout ? judged.filter((x) => !x.available && x.units90d > 0) : []
  const atRisk = stillAvailable.filter((x) => x.forecast && (x.forecast.risk === "sous_le_delai" || x.forecast.risk === "probable"))
  if (soldOut.length === 0 && atRisk.length === 0) return null
  return { soldOut, atRisk, stillAvailable: stillAvailable.length }
}

/** Small stable hash (FNV-1a, 32 bits) — keeps the id short whatever the variant names. */
function shortHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * Claim id: once per product, per SET of sold-out variants and per 14-day window. A NEW variant selling out is new
 * information (new id); the same situation is never rung twice in the window; risk-only notices share one id per
 * window (a cover estimate moving a little is not news).
 */
function variantNoticeSuffix(productId: string, n: VariantNotice, now: Date): string {
  const keys = n.soldOut.map((x) => x.key ?? "").filter(Boolean).sort()
  const set = keys.length ? shortHash(keys.join("\u0001")) : "risk"
  return `${productId}:${set}:${Math.floor(now.getTime() / (VARIANT_ALERT_WINDOW_DAYS * DAY))}`
}
export function variantAlertId(productId: string, n: VariantNotice, now: Date): string {
  return `supplier-variant-stock-alert:${variantNoticeSuffix(productId, n, now)}`
}
export function variantObservedId(productId: string, n: VariantNotice, now: Date): string {
  return `supplier-variant-stock-observed:${variantNoticeSuffix(productId, n, now)}`
}

/** The labels a bell quotes: sold-out first (what is lost now), then at risk; capped, each shortened. */
export function variantNoticeLabels(n: VariantNotice): { soldOut: string[]; atRisk: string[]; more: number } {
  const cut = (l: string) => (l.length > 40 ? `${l.slice(0, 39)}…` : l)
  const so = n.soldOut.map((x) => cut(x.label))
  const ar = n.atRisk.map((x) => cut(x.label))
  const soldOut = so.slice(0, VARIANT_ALERT_MAX_LABELS)
  const atRisk = ar.slice(0, Math.max(0, VARIANT_ALERT_MAX_LABELS - soldOut.length))
  return { soldOut, atRisk, more: so.length + ar.length - soldOut.length - atRisk.length }
}
