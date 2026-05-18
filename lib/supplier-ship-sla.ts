import { prisma } from "@/lib/prisma"

/** Marketplace: ship within 48h of payment (`Order.createdAt`). */
export const SUPPLIER_SHIP_SLA_HOURS = 48
export const SUPPLIER_SHIP_SLA_MS = SUPPLIER_SHIP_SLA_HOURS * 60 * 60 * 1000

/** Urgent threshold: less than 24h left before SLA breach. */
export const SUPPLIER_SHIP_SLA_URGENT_HOURS = 24

/** Display penalty per late order (EUR cents). */
export const SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS = 500

export type OrdersToShipSlaSnapshot = {
  count: number
  /** Hours until soonest SLA breach (48h − hours since payment). */
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

/** hoursLeft = 48 − hoursSince(paymentAt) */
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

/** @deprecated Prefer formatHoursLeftLabel — kept for legacy call sites. */
export function formatSlaHoursShort(ms: number): string {
  const hours = Math.max(0, Math.ceil(ms / 3_600_000))
  return hours >= 1 ? `${hours}h` : "< 1h"
}

function analyzeSla(createdAts: Date[], nowMs: number): Pick<
  OrdersToShipSlaSnapshot,
  "minHoursLeft" | "msUntilBreach" | "isLate" | "isUrgent"
> {
  if (createdAts.length === 0) {
    return { minHoursLeft: null, msUntilBreach: null, isLate: false, isUrgent: false }
  }

  let minHoursLeft = Infinity
  for (const paymentAt of createdAts) {
    const left = hoursLeftFromPayment(paymentAt, nowMs)
    minHoursLeft = Math.min(minHoursLeft, left)
  }

  if (!Number.isFinite(minHoursLeft)) {
    return { minHoursLeft: null, msUntilBreach: null, isLate: false, isUrgent: false }
  }

  const isLate = minHoursLeft <= 0
  const isUrgent = minHoursLeft < SUPPLIER_SHIP_SLA_URGENT_HOURS
  const msUntilBreach = Math.round(minHoursLeft * 3_600_000)

  return { minHoursLeft, msUntilBreach, isLate, isUrgent }
}

export async function loadOrdersToShipSla(supplierId: string): Promise<OrdersToShipSlaSnapshot> {
  const blindProfile = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: supplierId },
    select: { id: true },
  })

  const [marketplace, blind] = await Promise.all([
    prisma.order.findMany({
      where: { supplierId, status: { in: ["paid", "preparing"] } },
      select: { createdAt: true },
    }),
    blindProfile
      ? prisma.blindDropshipOrder.findMany({
          where: {
            status: { in: ["paid", "fulfilling", "awaiting_manual_payment"] },
            items: { some: { blindDropshipSupplierId: blindProfile.id } },
          },
          select: { createdAt: true },
        })
      : Promise.resolve([]),
  ])

  const createdAts = [...marketplace.map((o) => o.createdAt), ...blind.map((o) => o.createdAt)]
  const count = createdAts.length
  const nowMs = Date.now()
  const sla = analyzeSla(createdAts, nowMs)

  return {
    count,
    ...sla,
    penaltyPerOrderCents: count > 0 ? SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS : 0,
    totalPenaltyCents: count > 0 ? count * SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS : 0,
  }
}
