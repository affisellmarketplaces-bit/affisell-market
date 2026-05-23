/** Affisell marketplace platform fee on HT (products + shipping), never on tax. */
export const COMMISSION_RATE = 0.12

export type CommissionSplitInput = {
  /** HT products (excl. tax). */
  subtotalCents: number
  /** HT shipping. */
  shippingCents: number
  /** VAT collected by seller (Stripe Tax). */
  taxCents: number
  stripeFeeCents: number
  /** Basis points on HT (1000 = 10%, 1200 = 12%). Defaults to COMMISSION_RATE. */
  commissionRateBps?: number
}

export type CommissionSplitResult = {
  totalCents: number
  commissionCents: number
  sellerPayoutCents: number
  stripeFeeCents: number
  taxCents: number
  platformRevenueCents: number
}

export function calculateSplit(params: CommissionSplitInput): CommissionSplitResult {
  const subtotalCents = Math.max(0, Math.round(params.subtotalCents))
  const shippingCents = Math.max(0, Math.round(params.shippingCents))
  const taxCents = Math.max(0, Math.round(params.taxCents))
  const stripeFeeCents = Math.max(0, Math.round(params.stripeFeeCents))

  const commissionBaseCents = subtotalCents + shippingCents
  const rate =
    params.commissionRateBps != null
      ? params.commissionRateBps / 10_000
      : COMMISSION_RATE
  const commissionCents = Math.round(commissionBaseCents * rate)
  const totalCents = subtotalCents + shippingCents + taxCents
  const sellerPayoutCents = totalCents - commissionCents - stripeFeeCents

  if (sellerPayoutCents < 0) {
    throw new Error("Seller payout negative: check amounts")
  }

  return {
    totalCents,
    commissionCents,
    sellerPayoutCents,
    stripeFeeCents,
    taxCents,
    platformRevenueCents: commissionCents,
  }
}

export type OrderCommissionRefundSlice = {
  totalCents: number | null
  /** Platform commission stored as `platformCommissionCents` on Order. */
  commissionCents: number
  taxCents: number
}

export function calculateRefundSplit(
  order: OrderCommissionRefundSlice,
  refundAmountCents: number
): { commissionReturnedCents: number; taxReturnedCents: number } {
  const totalCents = Math.max(1, Math.round(order.totalCents ?? 0))
  const refund = Math.max(0, Math.round(refundAmountCents))
  const ratio = refund / totalCents
  const commissionReturnedCents = Math.round((order.commissionCents ?? 0) * ratio)
  const taxReturnedCents = Math.round((order.taxCents ?? 0) * ratio)
  return { commissionReturnedCents, taxReturnedCents }
}

/** Map Prisma order fields to refund slice. */
export function orderToCommissionRefundSlice(order: {
  totalCents: number | null
  sellingPriceCents: number
  platformCommissionCents: number
  taxCents: number
}): OrderCommissionRefundSlice {
  return {
    totalCents: order.totalCents ?? order.sellingPriceCents,
    commissionCents: order.platformCommissionCents,
    taxCents: order.taxCents,
  }
}
