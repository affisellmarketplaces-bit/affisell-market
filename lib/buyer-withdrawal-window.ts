/** EU consumer withdrawal — 14 days from delivery (or receipt proxy). */

export const EU_WITHDRAWAL_DAYS = 14

type WithdrawalAnchorOrder = {
  deliveredAt: Date | null
  deliveryConfirmedAt: Date | null
}

export function withdrawalAnchorAt(order: WithdrawalAnchorOrder): Date | null {
  return order.deliveredAt ?? order.deliveryConfirmedAt ?? null
}

export function euWithdrawalEndsAt(order: WithdrawalAnchorOrder): Date | null {
  const anchor = withdrawalAnchorAt(order)
  if (!anchor) return null
  const end = new Date(anchor)
  end.setDate(end.getDate() + EU_WITHDRAWAL_DAYS)
  return end
}

export function isWithinEuWithdrawalWindow(
  order: WithdrawalAnchorOrder,
  now = new Date()
): boolean {
  const end = euWithdrawalEndsAt(order)
  if (!end) return false
  return now <= end
}
