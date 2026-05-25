/** Ship SLA constants + pure formatters (no Prisma — safe for client UI). */

export const SUPPLIER_SHIP_SLA_HOURS = 48
export const SUPPLIER_SHIP_SLA_MS = SUPPLIER_SHIP_SLA_HOURS * 60 * 60 * 1000
export const SUPPLIER_SHIP_SLA_URGENT_HOURS = 24
export const SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS = 500

export type OrdersToShipSlaSnapshot = {
  count: number
  minHoursLeft: number | null
  msUntilBreach: number | null
  isLate: boolean
  isUrgent: boolean
  penaltyPerOrderCents: number
  totalPenaltyCents: number
}

export function hoursSincePayment(paymentAt: Date, nowMs = Date.now()): number {
  return (nowMs - paymentAt.getTime()) / 3_600_000
}

export function hoursLeftFromPayment(paymentAt: Date, nowMs = Date.now()): number {
  return SUPPLIER_SHIP_SLA_HOURS - hoursSincePayment(paymentAt, nowMs)
}

export function formatSlaCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h${String(minutes).padStart(2, "0")}`
}

export function formatHoursLeftLabel(hoursLeft: number): string {
  if (hoursLeft <= 0) return "SLA dépassé"
  const h = Math.floor(hoursLeft)
  const m = Math.round((hoursLeft - h) * 60)
  if (h >= 1) return `< ${h}h`
  return m > 0 ? `${m} min` : "< 1h"
}

/** @deprecated Prefer formatHoursLeftLabel */
export function formatSlaHoursShort(ms: number): string {
  const hours = Math.max(0, Math.ceil(ms / 3_600_000))
  return hours >= 1 ? `${hours}h` : "< 1h"
}
