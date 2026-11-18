/**
 * Product lifecycle (founder decision 2026-11-18): publication (`isDraft`), commercial status (`active`) and
 * availability (`stock`) are independent. A stock source — a partner API, a probe — writes the AVAILABILITY axis only.
 */

/** A partner count as a stock value: whole, never negative; anything unreadable counts as 0 (sold out, still listed). */
export function partnerStockValue(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/** The only product fields a stock sync may write. `active` and `isDraft` are deliberately absent. */
export function partnerStockUpdate(raw: unknown): { stock: number } {
  return { stock: partnerStockValue(raw) }
}

/**
 * What a supplier form save writes to `Product.stock` (chantier 2 — sold units are never resurrected).
 *
 * The form sends the stock it shows (`submitted`) and the stock it LOADED from the server (`baseline`). Between the two,
 * sales may have decremented the stock (CHECKOUT_STOCK_MODE=enforce). Rules:
 * - submitted unreadable → keep the current stock (no write);
 * - baseline sent and submitted === baseline → the supplier did not touch the stock: keep the current stock (a save of
 *   the title or the photos used to write the loaded value back and resurrect the units sold meanwhile);
 * - baseline sent and different → apply the supplier's CHANGE (submitted − baseline) to the current stock, never below 0;
 * - no baseline (legacy client, API caller) → the submitted value, as before.
 */
export function resolveSupplierStockWrite(input: { current: number; submitted: unknown; baseline: unknown }): number {
  const current = Math.max(0, Math.round(Number.isFinite(input.current) ? input.current : 0))
  const submitted = toFiniteNumber(input.submitted)
  if (submitted == null) return current
  const target = Math.max(0, Math.round(submitted))
  const baselineRaw = toFiniteNumber(input.baseline)
  if (baselineRaw == null) return target
  const baseline = Math.max(0, Math.round(baselineRaw))
  if (target === baseline) return current
  return Math.max(0, current + (target - baseline))
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

type StockRow = { id?: unknown; name?: unknown; stock?: unknown }

function rowKey(row: StockRow): string | null {
  if (typeof row.id === "string" && row.id.trim()) return `id:${row.id.trim()}`
  if (typeof row.name === "string" && row.name.trim()) return `name:${row.name.trim().toLowerCase()}`
  return null
}

/**
 * Same rule as `resolveSupplierStockWrite`, row by row, for the advanced SKU table (`variants.variantRows[].stock`):
 * the form sends each row's stock as it loaded it (`baseline`, keyed by row id — `id:<id>` — else name — `name:<name>`).
 * An untouched row keeps its CURRENT stock (sales decrement the row in enforce mode); a changed row gets the
 * supplier's change on top; a row unknown to the server (new SKU) or without a baseline takes the submitted value.
 * Returns the rows to store and their total, which becomes `Product.stock` (the sum the PDP reads).
 */
export function mergeVariantRowStocks<R extends StockRow>(args: {
  existingRows: ReadonlyArray<StockRow>
  incomingRows: ReadonlyArray<R>
  baseline: Readonly<Record<string, unknown>> | null | undefined
}): { rows: Array<R & { stock: number }>; total: number } {
  const current = new Map<string, number>()
  for (const row of args.existingRows) {
    const key = rowKey(row)
    const n = Number(row.stock)
    if (key && Number.isFinite(n)) current.set(key, Math.max(0, Math.round(n)))
  }
  const rows = args.incomingRows.map((row) => {
    const key = rowKey(row)
    const known = key != null && current.has(key)
    const stock = resolveSupplierStockWrite({
      current: known ? current.get(key!)! : 0,
      submitted: row.stock,
      baseline: known && args.baseline ? args.baseline[key!] : undefined,
    })
    return { ...row, stock }
  })
  return { rows, total: rows.reduce((acc, r) => acc + r.stock, 0) }
}

/** The baseline key of a variant row, as the form must send it (`variantStockBaseline`). */
export function variantStockBaselineKey(row: StockRow): string | null {
  return rowKey(row)
}

/** The `variantStockBaseline` a form sends: each row's stock as it loaded it, keyed like the server merges. */
export function variantStockBaselineFromRows(rows: unknown): Record<string, number> | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const out: Record<string, number> = {}
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const key = rowKey(row as StockRow)
    const n = Number((row as StockRow).stock)
    if (key && Number.isFinite(n)) out[key] = Math.max(0, Math.round(n))
  }
  return Object.keys(out).length > 0 ? out : null
}
