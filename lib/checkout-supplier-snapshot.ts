/**
 * The supplier price is frozen at CHECKOUT (finalisation D — price change between the checkout and the payment).
 *
 * The checkout refuses a listing priced below the supplier's current price (lib/checkout-price-guard.ts), but the
 * supplier can raise the price in the minutes between the checkout and the payment confirmation. The fulfilment used to
 * read the CURRENT price: the order was settled at a supplier price the buyer never paid for, the payouts exceeded the
 * line (`split_payout_exceeds_line`) and nobody could be paid. The checkout now records the supplier unit price of each
 * line (`lineSupplierUnits` in the Stripe session metadata; the single-line checkout already stores it on the pre-created
 * order) and the order is settled at that price. The new price applies to the next sales.
 *
 * Fallback: no snapshot (a session created before this change, or metadata too long) = the current price, as before.
 */

/** JSON array of integer cents, one per cart line, or `undefined` when it would not fit Stripe's 500-character value. */
export function encodeLineSupplierUnits(units: number[]): string | undefined {
  if (units.length === 0 || units.some((u) => !Number.isFinite(u) || u < 0)) return undefined
  const encoded = JSON.stringify(units.map((u) => Math.round(u)))
  return encoded.length <= 500 ? encoded : undefined
}

export function lineSupplierUnitFromMetadata(units: number[] | null, lineCount: number, index: number): number | null {
  if (!units || units.length !== lineCount) return null
  const v = units[index]
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null
}

/** The unit supplier price to settle at: the checkout snapshot when known, else the current price. Logs a change. */
export function resolveSettlementUnitSupplierCents(args: {
  checkoutUnitCents: number | null | undefined
  currentUnitCents: number
  context?: Record<string, unknown>
}): number {
  const snapshot = args.checkoutUnitCents
  if (snapshot == null || !Number.isFinite(snapshot) || snapshot <= 0) return Math.max(0, Math.round(args.currentUnitCents))
  const current = Math.max(0, Math.round(args.currentUnitCents))
  if (current !== snapshot) {
    console.warn("[marketplace-fulfill]", {
      result: "supplier_price_changed_since_checkout",
      checkoutUnitCents: snapshot,
      currentUnitCents: current,
      settledAt: "checkout_price",
      ...args.context,
    })
  }
  return Math.round(snapshot)
}
