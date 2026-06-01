/** Ship SLA constants + pure formatters (no Prisma — safe for client UI). */

export const SUPPLIER_SHIP_SLA_DAYS = 10
export const SUPPLIER_SHIP_SLA_HOURS = SUPPLIER_SHIP_SLA_DAYS * 24
export const SUPPLIER_SHIP_SLA_MS = SUPPLIER_SHIP_SLA_HOURS * 60 * 60 * 1000
/** UI warning when fewer than 2 days remain on the initial window. */
export const SUPPLIER_SHIP_SLA_URGENT_HOURS = 48
/** UI critical when fewer than 24h remain. */
export const SUPPLIER_SHIP_SLA_CRITICAL_HOURS = 24
export const SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS = 500

/** Buyer must accept or refuse an extension request within this window. */
export const SHIP_EXTENSION_BUYER_RESPONSE_DAYS = 3
export const SHIP_EXTENSION_BUYER_RESPONSE_MS =
  SHIP_EXTENSION_BUYER_RESPONSE_DAYS * 24 * 60 * 60 * 1000

/** After the 10-day deadline, supplier may message / request extension before auto-cancel. */
export const SHIP_EXTENSION_SUPPLIER_GRACE_DAYS = 3
export const SHIP_EXTENSION_SUPPLIER_GRACE_MS =
  SHIP_EXTENSION_SUPPLIER_GRACE_DAYS * 24 * 60 * 60 * 1000

export const SHIP_EXTENSION_DEFAULT_EXTRA_DAYS = 7
export const SHIP_EXTENSION_MIN_EXTRA_DAYS = 3
export const SHIP_EXTENSION_MAX_EXTRA_DAYS = 14

export type ShipPulsePhase = "safe" | "urgent" | "critical" | "breached"

export type ShipPulseSnapshot = {
  deadlineAt: string
  msRemaining: number
  hoursLeft: number
  phase: ShipPulsePhase
  extensionPending?: boolean
  extensionAccepted?: boolean
}

export function orderPaymentAnchorAt(order: { paidAt: Date | null; createdAt: Date }): Date {
  return order.paidAt ?? order.createdAt
}

export function computeShipDeadlineAt(paymentAt: Date): Date {
  return new Date(paymentAt.getTime() + SUPPLIER_SHIP_SLA_MS)
}

export function resolveShipDeadlineAt(order: {
  shipDeadlineAt: Date | null
  paidAt: Date | null
  createdAt: Date
}): Date {
  return order.shipDeadlineAt ?? computeShipDeadlineAt(orderPaymentAnchorAt(order))
}

export function buildShipPulseSnapshot(
  deadlineAt: Date,
  nowMs = Date.now(),
  flags?: { extensionPending?: boolean; extensionAccepted?: boolean }
): ShipPulseSnapshot {
  const msRemaining = deadlineAt.getTime() - nowMs
  const hoursLeft = msRemaining / 3_600_000
  let phase: ShipPulsePhase = "safe"
  if (hoursLeft <= 0) phase = "breached"
  else if (hoursLeft < SUPPLIER_SHIP_SLA_CRITICAL_HOURS) phase = "critical"
  else if (hoursLeft < SUPPLIER_SHIP_SLA_URGENT_HOURS) phase = "urgent"

  return {
    deadlineAt: deadlineAt.toISOString(),
    msRemaining,
    hoursLeft,
    phase,
    extensionPending: flags?.extensionPending,
    extensionAccepted: flags?.extensionAccepted,
  }
}

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

/** Countdown for Ship Pulse badge (days when > 48h left). */
export function formatShipPulseCountdown(ms: number): string {
  if (ms <= 0) return "0d 00h"
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours >= 48) {
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    return `${days}d ${String(hours).padStart(2, "0")}h`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h${String(minutes).padStart(2, "0")}`
}

export function formatSlaCountdown(ms: number): string {
  return formatShipPulseCountdown(ms)
}

export function formatHoursLeftLabel(hoursLeft: number): string {
  if (hoursLeft <= 0) return "SLA dépassé"
  if (hoursLeft >= 24) {
    const d = Math.floor(hoursLeft / 24)
    const h = Math.floor(hoursLeft % 24)
    return h > 0 ? `< ${d}j ${h}h` : `< ${d}j`
  }
  const h = Math.floor(hoursLeft)
  const m = Math.round((hoursLeft - h) * 60)
  if (h >= 1) return `< ${h}h`
  return m > 0 ? `${m} min` : "< 1h"
}

/** @deprecated Prefer formatHoursLeftLabel */
/** True when the 10-day ship window has elapsed (supplier pressure UI). */
export function isShipDeadlineBreached(
  pulse: Pick<ShipPulseSnapshot, "phase" | "msRemaining"> | null | undefined
): boolean {
  if (!pulse) return false
  return pulse.phase === "breached" || pulse.msRemaining <= 0
}

/** Last hours before breach — show warning styling. */
export function isShipDeadlineCritical(
  pulse: Pick<ShipPulseSnapshot, "phase" | "msRemaining"> | null | undefined
): boolean {
  if (!pulse || isShipDeadlineBreached(pulse)) return false
  return pulse.phase === "critical"
}

export function formatSlaHoursShort(ms: number): string {
  const hours = Math.max(0, Math.ceil(ms / 3_600_000))
  if (hours >= 24) {
    const d = Math.ceil(hours / 24)
    return `${d}j`
  }
  return hours >= 1 ? `${hours}h` : "< 1h"
}
