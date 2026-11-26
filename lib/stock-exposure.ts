/**
 * Paid orders not shipped yet vs the stock a product page shows (founder brief 2026-11-19 §3). Pure, no import.
 *
 * What the code does today (read from it, not assumed):
 *  - `CHECKOUT_STOCK_MODE=enforce`: the units are taken at payment, ONCE (`reserveStockInTransaction`, inside the
 *    payment transaction; a replayed event finds the order already paid), and given back once if the order is closed
 *    before shipping (`stock-restored:<orderId>`). The page then shows the stock still sellable. Nothing else deducts
 *    them: a supplier's form save applies only the supplier's own change (`stockBaseline`), the forecasts subtract
 *    reserved units only when the platform does NOT deduct them. No double deduction.
 *  - `warn` (DEFAULT) and `off`: NOTHING is taken at payment. The page shows the declared stock as typed by the
 *    supplier; whether the units sold since are already out of it depends on whether the supplier updated the sheet —
 *    Affisell can not know. Subtracting them on the page would deduct twice for a supplier who did.
 * So the two readings are kept side by side and never merged: « declared already up to date » and « declared still
 * counts the units sold ». This module measures how far apart they are; it decides nothing and changes nothing.
 */

export type ExposureProduct = { productId: string; declaredUnits: number }
export type PendingUnits = { productId: string; units: number }

export type ReservationExposure = {
  /** The platform deducts at payment (enforce): the second reading does not apply. */
  platformDeducts: boolean
  productsWithPendingOrders: number
  pendingUnits: number
  /** Second reading only — products shown « in stock » (declared > 0) whose declared units are all owed already. */
  shownInStockButAllOwed: number
  /** Second reading only — products whose pending units exceed even the declared figure. */
  owedBeyondDeclared: number
  /** Second reading only — units a page may show that are already sold (Σ min(declared, pending)). */
  unitsShownButAlreadySold: number
}

export function summarizeReservationExposure(args: {
  products: ReadonlyArray<ExposureProduct>
  pending: ReadonlyArray<PendingUnits>
  platformDeducts: boolean
}): ReservationExposure {
  const owed = new Map<string, number>()
  for (const p of args.pending) {
    if (!p.productId) continue
    owed.set(p.productId, (owed.get(p.productId) ?? 0) + Math.max(0, Math.round(p.units) || 0))
  }
  let productsWithPendingOrders = 0
  let pendingUnits = 0
  let shownInStockButAllOwed = 0
  let owedBeyondDeclared = 0
  let unitsShownButAlreadySold = 0
  for (const prod of args.products) {
    const units = owed.get(prod.productId) ?? 0
    if (units <= 0) continue
    productsWithPendingOrders++
    pendingUnits += units
    if (args.platformDeducts) continue
    const declared = Math.max(0, Math.round(prod.declaredUnits) || 0)
    if (declared > 0 && declared - units <= 0) shownInStockButAllOwed++
    if (declared - units < 0) owedBeyondDeclared++
    unitsShownButAlreadySold += Math.min(declared, units)
  }
  return {
    platformDeducts: args.platformDeducts,
    productsWithPendingOrders,
    pendingUnits,
    shownInStockButAllOwed,
    owedBeyondDeclared,
    unitsShownButAlreadySold,
  }
}
