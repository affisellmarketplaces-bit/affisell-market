import type { Order, OrderReturn } from "@prisma/client"

import { getActiveReturn } from "@/lib/order-return-policy"

/** Pay merchants 7 days after buyer confirms receipt & satisfaction. */
export const PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM = 7

/** If carrier marked delivered and buyer is silent: auto-confirm after 7+3 days from delivery. */
export const AUTO_CONFIRM_DAYS_AFTER_DELIVERY = 10

export type DeliveryConfirmedBy = "buyer" | "auto_no_response"

export type OrderPayoutTiming = {
  deliveredAt: Date
  deliveryConfirmedAt: Date | null
  deliveryConfirmedBy: DeliveryConfirmedBy | null
  payoutEligibleAt: Date | null
  autoConfirmAt: Date
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function autoConfirmAt(deliveredAt: Date): Date {
  return addDays(deliveredAt, AUTO_CONFIRM_DAYS_AFTER_DELIVERY)
}

export function payoutEligibleAfterBuyerConfirm(confirmedAt: Date): Date {
  return addDays(confirmedAt, PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM)
}

export function orderPayoutTiming(
  order: Pick<Order, "shippedAt" | "deliveredAt" | "deliveryConfirmedAt" | "deliveryConfirmedBy" | "payoutEligibleAt">
): OrderPayoutTiming | null {
  const deliveredAt = order.deliveredAt ?? order.shippedAt
  if (!deliveredAt) return null

  const autoAt = autoConfirmAt(deliveredAt)
  let payoutEligibleAt = order.payoutEligibleAt

  if (order.deliveryConfirmedAt) {
    if (!payoutEligibleAt) {
      payoutEligibleAt = payoutEligibleAfterBuyerConfirm(order.deliveryConfirmedAt)
    }
  }

  return {
    deliveredAt,
    deliveryConfirmedAt: order.deliveryConfirmedAt,
    deliveryConfirmedBy: (order.deliveryConfirmedBy as DeliveryConfirmedBy | null) ?? null,
    payoutEligibleAt,
    autoConfirmAt: autoAt,
  }
}

export function isPayoutBlockedByReturn(returns: Pick<OrderReturn, "status">[]): boolean {
  const active = getActiveReturn(returns)
  if (active) return true
  return returns.some((r) => r.status === "REQUESTED" || r.status === "AWAITING_SHIPMENT" || r.status === "IN_TRANSIT")
}

export function shouldAutoConfirmDelivery(
  order: Pick<Order, "deliveredAt" | "shippedAt" | "deliveryConfirmedAt">,
  now = new Date()
): boolean {
  if (order.deliveryConfirmedAt) return false
  const deliveredAt = order.deliveredAt ?? order.shippedAt
  if (!deliveredAt) return false
  return now >= autoConfirmAt(deliveredAt)
}

export function isReadyForMerchantPayout(
  order: Pick<
    Order,
    | "status"
    | "deliveredAt"
    | "shippedAt"
    | "deliveryConfirmedAt"
    | "deliveryConfirmedBy"
    | "payoutEligibleAt"
    | "supplierPayoutAt"
    | "affiliatePayoutAt"
  >,
  returns: Pick<OrderReturn, "status">[],
  now = new Date()
): boolean {
  if (order.status !== "shipped") return false
  if (!order.deliveredAt && !order.shippedAt) return false
  if (order.supplierPayoutAt && order.affiliatePayoutAt) return false
  if (isPayoutBlockedByReturn(returns)) return false

  const timing = orderPayoutTiming(order)
  if (!timing) return false

  if (timing.deliveryConfirmedAt && timing.payoutEligibleAt && now >= timing.payoutEligibleAt) {
    return true
  }

  if (!timing.deliveryConfirmedAt && now >= timing.autoConfirmAt) {
    return true
  }

  return false
}

export function payoutStatusLabel(order: Pick<Order, "supplierPayoutAt" | "affiliatePayoutAt" | "payoutEligibleAt">): string {
  if (order.supplierPayoutAt && order.affiliatePayoutAt) return "Paid out"
  if (order.payoutEligibleAt && new Date() >= order.payoutEligibleAt) return "Payout pending"
  if (order.payoutEligibleAt) return "Scheduled"
  return "Awaiting delivery confirmation"
}
