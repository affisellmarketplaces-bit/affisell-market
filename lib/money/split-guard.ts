/**
 * Money-safety primitives for marketplace splits (pure, integer cents, no I/O).
 *
 * Three rules this module enforces for every payment:
 *  1. ONE commission figure feeds every leg (supplier and affiliate never disagree).
 *  2. The amount charged to the buyer (VAT included) is never silently replaced by the HT line.
 *  3. Affisell never transfers out more than the line was sold for.
 */

/** Rounding tolerance already used by `logPhase1SplitCheck`. */
export const SPLIT_TOLERANCE_CENTS = 2

const int = (n: number | null | undefined): number => Math.round(Number.isFinite(n ?? NaN) ? (n as number) : 0)
const pos = (n: number | null | undefined): number => Math.max(0, int(n))

export type CommissionSource = {
  commissionCents?: number | null
  affiliatePayoutCents?: number | null
  supplierPriceCents?: number | null
  basePriceCents?: number | null
  supplierCommissionRateBps?: number | null
}

/**
 * The affiliate commission leg, derived from immutable checkout facts.
 *
 * Priority: wholesale × bps (deterministic) → stored `commissionCents`.
 * `affiliatePayoutCents` is only a last resort on the FIRST scheduling: after the
 * scheduler ran it holds the NET Connect transfer (commission + markup − fee), so
 * reading it back as "commission" double-counts the markup.
 */
export function stableAffiliateCommissionCents(
  order: CommissionSource,
  opts: { allowPayoutFieldFallback?: boolean } = {}
): number {
  const bps = pos(order.supplierCommissionRateBps)
  const wholesale = pos(order.supplierPriceCents ?? order.basePriceCents)
  if (bps > 0 && wholesale > 0) return Math.round((wholesale * bps) / 10_000)

  const stored = pos(order.commissionCents)
  if (stored > 0) return stored

  return opts.allowPayoutFieldFallback ? pos(order.affiliatePayoutCents) : 0
}

export type ChargedTotalSource = {
  totalCents?: number | null
  subtotalCents?: number | null
  sellingPriceCents: number
  taxCents?: number | null
}

/**
 * Amount actually charged to the buyer (what a full refund must be able to return).
 * Detects the corruption fingerprint "total equals the HT line while VAT > 0" and
 * restores HT + VAT. Legitimate discounts (total below HT + VAT) are left untouched.
 */
export function orderChargedTotalCents(order: ChargedTotalSource): number {
  const net = pos(order.subtotalCents) > 0 ? pos(order.subtotalCents) : pos(order.sellingPriceCents)
  const tax = pos(order.taxCents)
  const total = pos(order.totalCents)
  if (tax > 0 && total <= net) return net + tax
  return total > 0 ? total : net + tax
}

/** HT amount the line was sold for — the ceiling for everything paid out of it. */
export function orderLineHtCents(order: {
  subtotalCents?: number | null
  sellingPriceCents: number
}): number {
  return pos(order.subtotalCents) > 0 ? pos(order.subtotalCents) : pos(order.sellingPriceCents)
}

export type TransferBudgetCheck =
  | { ok: true; totalCents: number; headroomCents: number }
  | { ok: false; totalCents: number; excessCents: number }

/**
 * Never pay out more than the line was sold for.
 * `alreadyPaidCents` = transfers that already succeeded for this order.
 */
export function checkTransferBudget(args: {
  lineHtCents: number
  transferCents: number[]
  alreadyPaidCents?: number
  toleranceCents?: number
}): TransferBudgetCheck {
  const tolerance = pos(args.toleranceCents ?? SPLIT_TOLERANCE_CENTS)
  const totalCents =
    args.transferCents.reduce((s, c) => s + pos(c), 0) + pos(args.alreadyPaidCents)
  const budget = pos(args.lineHtCents) + tolerance
  if (totalCents > budget) return { ok: false, totalCents, excessCents: totalCents - pos(args.lineHtCents) }
  return { ok: true, totalCents, headroomCents: budget - totalCents }
}

/** "enforce" blocks an over-budget transfer; "monitor" only logs/alerts (escape hatch). */
export function moneyGuardMode(env: Record<string, string | undefined> = process.env): "enforce" | "monitor" {
  return env.MONEY_GUARD_MODE?.trim().toLowerCase() === "monitor" ? "monitor" : "enforce"
}

export const PAYOUT_EXCEEDS_LINE_ERROR = "PAYOUT_EXCEEDS_LINE"

/**
 * A charge can carry several orders (multi-line cart). A refund must only ever be applied
 * to the order it was issued for; `refund.metadata.orderId` is stamped by our refund initiator.
 * - single-order charge → always applies
 * - multi-order charge + explicit orderId → applies only to that order
 * - multi-order charge, no orderId → ambiguous: never guess (needs manual review)
 */
export type RefundAttribution = "apply" | "other_order" | "ambiguous"

export function attributeRefundToOrder(args: {
  chargeOrderCount: number
  orderId: string
  refundMetadataOrderId?: string | null
}): RefundAttribution {
  if (args.chargeOrderCount <= 1) return "apply"
  const target = args.refundMetadataOrderId?.trim()
  if (!target) return "ambiguous"
  return target === args.orderId ? "apply" : "other_order"
}

/**
 * Full-refund test scoped to the order. On multi-order charges the charge-level
 * `amount_refunded` mixes other orders' refunds, so only this order's own refunds count.
 */
export function isOrderFullyRefunded(args: {
  chargeOrderCount: number
  chargeAmountRefundedCents?: number | null
  orderRefundedSumCents: number
  orderChargedTotalCents: number
}): boolean {
  const refunded =
    args.chargeOrderCount <= 1
      ? (args.chargeAmountRefundedCents ?? args.orderRefundedSumCents)
      : args.orderRefundedSumCents
  return refunded >= Math.max(0, args.orderChargedTotalCents) - 1
}

/**
 * Hard ceiling for money paid out of a line: the UNDISCOUNTED price (wholesale + affiliate
 * markup) or the amount collected, whichever is higher. Flash discounts and store credit lower
 * the collected amount but not the partners' shares (the platform funds them), so the collected
 * amount alone would wrongly block those legitimate sales. Paying out more than the undiscounted
 * price is never legitimate — that is the double-count signature the guard exists for.
 */
export function orderTransferCeilingCents(order: {
  subtotalCents?: number | null
  sellingPriceCents: number
  basePriceCents?: number | null
  supplierPriceCents?: number | null
  affiliateMarginCents?: number | null
}): number {
  const collected = orderLineHtCents(order)
  const wholesale = pos(order.supplierPriceCents ?? order.basePriceCents)
  const listPrice = wholesale + pos(order.affiliateMarginCents)
  return Math.max(collected, listPrice)
}

/** Part of the partners' payouts funded by Affisell (discount / store credit): payouts − collected. */
export function platformSubsidyCents(args: { lineHtCents: number; payoutsCents: number }): number {
  return Math.max(0, pos(args.payoutsCents) - pos(args.lineHtCents))
}
