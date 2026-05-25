import { prisma } from "@/lib/prisma"
import {
  formatHoursLeftLabel,
  formatSlaCountdown,
  formatSlaHoursShort,
  hoursLeftFromPayment,
  hoursSincePayment,
  SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS,
  SUPPLIER_SHIP_SLA_HOURS,
  SUPPLIER_SHIP_SLA_MS,
  SUPPLIER_SHIP_SLA_URGENT_HOURS,
  type OrdersToShipSlaSnapshot,
} from "@/lib/supplier-ship-sla-shared"

export {
  formatHoursLeftLabel,
  formatSlaCountdown,
  formatSlaHoursShort,
  hoursLeftFromPayment,
  hoursSincePayment,
  SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS,
  SUPPLIER_SHIP_SLA_HOURS,
  SUPPLIER_SHIP_SLA_MS,
  SUPPLIER_SHIP_SLA_URGENT_HOURS,
  type OrdersToShipSlaSnapshot,
} from "@/lib/supplier-ship-sla-shared"

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
