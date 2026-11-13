/**
 * Margin gate BEFORE any autonomous supplier purchase (G3) — pure, integer cents, no I/O, no Prisma.
 *
 * Why it exists: an AliExpress purchase is paid with Affisell's own money, at the moment the buyer's payment lands, and
 * nothing used to check that the sale could pay for it. This function answers one question: "after everything that
 * leaves Affisell for this line, is there still at least `AUTO_BUY_MIN_MARGIN_CENTS` left?".
 *
 *   margin = HT collected for the line
 *          − supplier Connect transfer          (existing settlement functions, from the order snapshot)
 *          − affiliate Connect transfer         (idem)
 *          − estimated Stripe fee               (2.9 % + 25 c on what the buyer was charged, VAT included)
 *          − AliExpress purchase cost           (unit price × quantity + shipping, of the SKU that will be bought)
 *
 * The first three terms are the money model already used at payout time (`computeTransferAmountsFromOrder`,
 * `orderChargedTotalCents`, `orderLineHtCents`): this module re-derives nothing, so the gate and the payouts cannot
 * disagree. What is left of the HT line after the two transfers is Affisell's own take (supplier fee + affiliate fee).
 *
 * FAIL CLOSED. A purchase is refused when the cost is unknown (no/zero AE price, negative values), when the revenue
 * is unknown, or when the margin is below the floor. A negative margin is always refused, whatever the floor says.
 *
 * Known modelling limit (documented, not hidden): returns, refunds, currency conversion and a stale AE price are NOT
 * modelled; VAT is assumed passed through (it is not part of the HT line).
 */

import { computeTransferAmountsFromOrder, estimateStripeFeeCents, orderSplitInputFromOrder } from "@/lib/marketplace-split-amounts"
import { orderChargedTotalCents, orderLineHtCents } from "@/lib/money/split-guard"

/** Prudent default floor: 3.00 EUR left after everything. Override with `AUTO_BUY_MIN_MARGIN_CENTS`. */
export const DEFAULT_AUTO_BUY_MIN_MARGIN_CENTS = 300

/**
 * Parse `AUTO_BUY_MIN_MARGIN_CENTS`. Only a plain non-negative integer is accepted; anything else (unset, empty, "abc",
 * "-5", "2.5", "1e3") falls back to the prudent default — a typo must never lower the floor to zero.
 */
export function readAutoBuyMinMarginCents(
  raw: string | undefined = process.env.AUTO_BUY_MIN_MARGIN_CENTS
): number {
  const text = raw?.trim() ?? ""
  if (!/^\d{1,9}$/.test(text)) return DEFAULT_AUTO_BUY_MIN_MARGIN_CENTS
  return Number(text)
}

export type AutoBuyMarginBreakdown = {
  collectedHtCents: number
  chargedTotalCents: number
  supplierPayoutCents: number
  affiliateTransferCents: number
  stripeFeeCents: number
  aeUnitPriceCents: number
  aeShippingCents: number
  quantity: number
  aeCostCents: number
}

export type AutoBuyMarginRefusalReason = "cost_unknown" | "revenue_unknown" | "margin_below_floor"

export type AutoBuyMarginDecision =
  | { allowed: true; marginCents: number; floorCents: number; breakdown: AutoBuyMarginBreakdown }
  | {
      allowed: false
      reason: AutoBuyMarginRefusalReason
      /** null when the margin could not be computed (unknown cost / revenue). */
      marginCents: number | null
      floorCents: number
      breakdown: AutoBuyMarginBreakdown | null
    }

/** Order columns the money model needs (a subset of the `Order` row — see `orderSplitInputFromOrder`). */
export type AutoBuyMarginOrder = Parameters<typeof orderSplitInputFromOrder>[0] & {
  quantity: number
  taxCents?: number | null
  totalCents?: number | null
}

export type AutoBuyMarginCost = {
  /** AE unit price of the SKU that will be bought. null / 0 / negative = unknown. */
  aeUnitPriceCents: number | null | undefined
  /** AE shipping for the order. 0 is a legitimate value (free shipping); null / negative = unknown. */
  aeShippingCents: number | null | undefined
}

const isCents = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

export function evaluateAutoBuyMargin(
  order: AutoBuyMarginOrder,
  cost: AutoBuyMarginCost,
  opts: { minMarginCents?: number } = {}
): AutoBuyMarginDecision {
  const floorCents = Math.max(0, Math.round(opts.minMarginCents ?? readAutoBuyMinMarginCents()))

  const unit = cost.aeUnitPriceCents
  const shipping = cost.aeShippingCents
  if (!isCents(unit) || unit <= 0 || !isCents(shipping) || shipping < 0) {
    return { allowed: false, reason: "cost_unknown", marginCents: null, floorCents, breakdown: null }
  }

  const collectedHtCents = orderLineHtCents(order)
  if (collectedHtCents <= 0) {
    return { allowed: false, reason: "revenue_unknown", marginCents: null, floorCents, breakdown: null }
  }

  const quantity = Math.max(1, Math.floor(order.quantity) || 1)
  const aeUnitPriceCents = Math.round(unit)
  const aeShippingCents = Math.round(shipping)
  const aeCostCents = aeUnitPriceCents * quantity + aeShippingCents

  // `firstSchedule: false`: never read `affiliatePayoutCents` back as the commission — once the transfer scheduler ran it holds
  // the NET transfer (commission + markup − fee), which would count the markup twice. `commissionCents` is immutable.
  const amounts = computeTransferAmountsFromOrder(orderSplitInputFromOrder(order, { firstSchedule: false }))
  const chargedTotalCents = orderChargedTotalCents({
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    sellingPriceCents: order.sellingPriceCents,
    taxCents: order.taxCents,
  })
  // Stripe's fee is taken on what the buyer was charged (VAT included), not on the HT line.
  const stripeFeeCents = estimateStripeFeeCents(chargedTotalCents)

  const breakdown: AutoBuyMarginBreakdown = {
    collectedHtCents,
    chargedTotalCents,
    supplierPayoutCents: amounts.supplierPayoutCents,
    affiliateTransferCents: amounts.affiliateTransferCents,
    stripeFeeCents,
    aeUnitPriceCents,
    aeShippingCents,
    quantity,
    aeCostCents,
  }

  const marginCents =
    collectedHtCents -
    breakdown.supplierPayoutCents -
    breakdown.affiliateTransferCents -
    breakdown.stripeFeeCents -
    breakdown.aeCostCents

  if (marginCents < 0 || marginCents < floorCents) {
    return { allowed: false, reason: "margin_below_floor", marginCents, floorCents, breakdown }
  }
  return { allowed: true, marginCents, floorCents, breakdown }
}

/** One-line, language-neutral reason stored on the order / log and sent to the alert. No customer data. */
export function formatAutoBuyMarginRefusal(
  decision: Extract<AutoBuyMarginDecision, { allowed: false }>
): string {
  const margin = decision.marginCents == null ? "n/a" : String(decision.marginCents)
  return `MARGIN_REFUSED:${decision.reason}:margin=${margin}:floor=${decision.floorCents}`
}
