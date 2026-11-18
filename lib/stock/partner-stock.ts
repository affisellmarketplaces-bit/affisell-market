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
