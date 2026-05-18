import { prisma } from "@/lib/prisma"

/** Marketplace: ship within 48h of payment (display SLA for Mission Control). */
export const SUPPLIER_SHIP_SLA_MS = 48 * 60 * 60 * 1000

/** Estimated platform penalty if shipment misses SLA (EUR cents, display only). */
export const SUPPLIER_LATE_SHIP_PENALTY_CENTS = 1500

export type OrdersToShipSlaSnapshot = {
  count: number
  /** Milliseconds until the soonest SLA breach; 0 if already late. */
  msUntilBreach: number | null
  penaltyCents: number
}

export function formatSlaCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h${String(minutes).padStart(2, "0")}`
}

/** Compact hours label for card title, e.g. « < 22h » (matches countdown hour). */
export function formatSlaHoursShort(ms: number): string {
  const hours = Math.max(1, Math.floor(ms / 3_600_000))
  return `${hours}h`
}

function soonestBreachMs(createdAts: Date[], nowMs: number): number | null {
  if (createdAts.length === 0) return null
  let minRemaining = Infinity
  for (const createdAt of createdAts) {
    const remaining = createdAt.getTime() + SUPPLIER_SHIP_SLA_MS - nowMs
    minRemaining = Math.min(minRemaining, remaining)
  }
  return minRemaining === Infinity ? null : minRemaining
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
  const raw = soonestBreachMs(createdAts, nowMs)

  return {
    count,
    msUntilBreach: raw,
    penaltyCents: count > 0 ? SUPPLIER_LATE_SHIP_PENALTY_CENTS : 0,
  }
}
