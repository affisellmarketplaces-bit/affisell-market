import { NextResponse } from "next/server"

/**
 * A listing must never be sold below the supplier's CURRENT price (finalisation D, money path).
 *
 * The reseller's selling price is fixed on the listing; the supplier price can rise afterwards (form, import, sync,
 * AliExpress refresh). A buyer then paid less than what the settlement owes the supplier: the split's guard refused the
 * payouts (`split_payout_exceeds_line`) — the buyer was charged and NOBODY could be paid — or Affisell funded the gap.
 * Adding a listing already refuses a price below the supplier price (`/api/affiliate/products/add`); this is the same rule
 * at checkout, where the price really matters. The listing is flagged for the reseller (`marginReviewNeeded`), who fixes it
 * in one click (margin auto-fix); the buyer is told the price is being updated, never a raw code.
 *
 * Applied to the unit price BEFORE a battle flash discount or store credit (those are deliberate reductions with their own
 * funding rules).
 */
export const PRICE_BELOW_SUPPLIER_PRICE = "PRICE_BELOW_SUPPLIER_PRICE" as const

export function isPricedBelowSupplierPrice(args: { unitSellingCents: number; unitSupplierCents: number }): boolean {
  const sell = Math.round(Number(args.unitSellingCents))
  const supplier = Math.round(Number(args.unitSupplierCents))
  if (!Number.isFinite(sell) || !Number.isFinite(supplier) || supplier <= 0) return false
  return sell < supplier
}

export function priceBelowSupplierPriceResponse(): NextResponse {
  return NextResponse.json({ error: PRICE_BELOW_SUPPLIER_PRICE }, { status: 409 })
}
