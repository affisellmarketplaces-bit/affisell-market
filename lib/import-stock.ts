/**
 * Where an imported quantity comes from — founder decision 2026-11-19.
 *
 * Importers used to write a fallback quantity (99, 999, 50 per variant, 1) when the
 * source gave none, and nothing told it apart from a real inventory afterwards. Rule:
 *
 *  - a quantity READ from the source (a number the source really returned, 0 included)
 *    is kept as is — a 99 or 999 the source reported is NOT presumed fictitious;
 *  - when the source gives no usable quantity, the product is written with stock 0
 *    (never sellable) and the reserved attribute `stock_unconfirmed` = "1": it stays a
 *    draft until the SUPPLIER saves a quantity, or an authorised ADMIN confirms one;
 *  - existing products are never rewritten (no backfill).
 *
 * `StockProvenance` travels with the import preview from the extractor that read the
 * page / API to the code that writes the Product row. A preview WITHOUT provenance is
 * treated as « not provided » (fail closed): a path that forgets to say where its
 * number comes from can not make it sellable.
 *
 * Pure, client-safe.
 */

export type StockProvenance = "source" | "not_provided"

/** Reserved `ProductAttribute` key (no migration): present = the quantity was never confirmed. */
export const STOCK_UNCONFIRMED_KEY = "stock_unconfirmed"
export const STOCK_UNCONFIRMED_LABEL = "Quantité à confirmer"

export const MAX_IMPORTED_STOCK = 1_000_000

/**
 * A quantity the source really returned: a finite number ≥ 0 (rounded), or a numeric
 * string. Missing / blank / null / not a number / negative = null (« not provided »).
 * Note: 0 IS a value (the source says sold out) — only absence is « not provided ».
 */
export function sourceQuantity(raw: unknown): number | null {
  let n: number
  if (typeof raw === "number") n = raw
  else if (typeof raw === "string" && raw.trim() !== "" && /^-?\d+(?:[.,]\d+)?$/.test(raw.trim())) {
    n = Number(raw.trim().replace(",", "."))
  } else return null
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(MAX_IMPORTED_STOCK, Math.round(n))
}

/** The pair an extractor returns: the quantity to show (0 when unknown) + where it comes from. */
export function stockFromSource(raw: unknown): { stock: number; stockProvenance: StockProvenance } {
  const q = sourceQuantity(raw)
  return q == null ? { stock: 0, stockProvenance: "not_provided" } : { stock: q, stockProvenance: "source" }
}

/** Sum of variant quantities when EVERY variant carries a source quantity; otherwise not provided. */
export function stockFromVariantQuantities(raw: ReadonlyArray<unknown>): { stock: number; stockProvenance: StockProvenance } {
  if (raw.length === 0) return { stock: 0, stockProvenance: "not_provided" }
  const qs = raw.map(sourceQuantity)
  if (qs.some((q) => q == null)) return { stock: 0, stockProvenance: "not_provided" }
  return { stock: Math.min(MAX_IMPORTED_STOCK, (qs as number[]).reduce((a, b) => a + b, 0)), stockProvenance: "source" }
}

export type ResolvedImportStock = {
  /** What is written to `Product.stock`. */
  stock: number
  /** False = the attribute `stock_unconfirmed` must be written and the product must stay a draft. */
  confirmed: boolean
}

/** The value written to the Product row. Unknown provenance = not confirmed = stock 0. */
export function resolveImportedStock(input: {
  stock: number | null | undefined
  stockProvenance?: StockProvenance | null
}): ResolvedImportStock {
  if (input.stockProvenance !== "source") return { stock: 0, confirmed: false }
  const q = sourceQuantity(input.stock)
  return q == null ? { stock: 0, confirmed: false } : { stock: q, confirmed: true }
}

export function stockUnconfirmedAttribute(): { key: string; label: string; value: string } {
  return { key: STOCK_UNCONFIRMED_KEY, label: STOCK_UNCONFIRMED_LABEL, value: "1" }
}

/** True when the product's attributes carry the « quantity never confirmed » marker. */
export function isStockUnconfirmed(
  attributes: ReadonlyArray<{ key: string; value?: string | null }> | null | undefined
): boolean {
  return (attributes ?? []).some((a) => a.key === STOCK_UNCONFIRMED_KEY && (a.value ?? "").trim() !== "")
}

/** Publication refusal code shared by every gate that reads the marker. */
export const STOCK_UNCONFIRMED_ERROR = "stock_unconfirmed"
