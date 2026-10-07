/** EU consumer withdrawal — 14 days from delivery (or receipt proxy). */

export const EU_WITHDRAWAL_DAYS = 14

type WithdrawalAnchorOrder = {
  deliveredAt: Date | null
  deliveryConfirmedAt: Date | null
}

export function withdrawalAnchorAt(order: WithdrawalAnchorOrder): Date | null {
  return order.deliveredAt ?? order.deliveryConfirmedAt ?? null
}

/**
 * `days` is the window frozen on the order at purchase (`lib/return-terms.ts`): the legal 14 unless the supplier offered
 * more. It can never be lower — callers go through `effectiveReturnWindowDays`.
 */
export function euWithdrawalEndsAt(
  order: WithdrawalAnchorOrder,
  days: number = EU_WITHDRAWAL_DAYS
): Date | null {
  const anchor = withdrawalAnchorAt(order)
  if (!anchor) return null
  const end = new Date(anchor)
  end.setDate(end.getDate() + Math.max(EU_WITHDRAWAL_DAYS, days))
  return end
}

export function isWithinEuWithdrawalWindow(
  order: WithdrawalAnchorOrder,
  now = new Date(),
  days: number = EU_WITHDRAWAL_DAYS
): boolean {
  const end = euWithdrawalEndsAt(order, days)
  if (!end) return false
  return now <= end
}
