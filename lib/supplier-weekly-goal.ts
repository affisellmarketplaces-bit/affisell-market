import { prisma } from "@/lib/prisma"

const MARKETPLACE_COUNTABLE = ["paid", "preparing", "shipped", "refunded"] as const

/** First weekly revenue target for new supplier stores (EUR cents). */
export const SUPPLIER_WEEKLY_GOAL_CENTS = 50_000

/** Show weekly goal card while store is younger than this (ms). */
export const NEW_SUPPLIER_STORE_MS = 90 * 24 * 60 * 60 * 1000

export const WEEKLY_GOAL_BAR_SEGMENTS = 10

export type SupplierWeeklyGoalSnapshot = {
  isNewStore: true
  weekGmvCents: number
  goalCents: number
  progressPct: number
  filledSegments: number
}

/** Monday 00:00:00.000 UTC for the week containing `d`. */
export function startOfUtcWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay()
  const daysFromMonday = (day + 6) % 7
  x.setUTCDate(x.getUTCDate() - daysFromMonday)
  return x
}

export function weeklyGoalProgressPct(weekGmvCents: number, goalCents: number): number {
  if (goalCents <= 0) return 0
  return Math.min(100, Math.floor((weekGmvCents / goalCents) * 100))
}

export function weeklyGoalFilledSegments(progressPct: number, segments = WEEKLY_GOAL_BAR_SEGMENTS): number {
  return Math.min(segments, Math.max(0, Math.round((progressPct / 100) * segments)))
}

export async function loadSupplierWeeklyGoal(
  supplierId: string,
  storeCreatedAt: Date | null
): Promise<SupplierWeeklyGoalSnapshot | null> {
  if (!storeCreatedAt) return null
  if (Date.now() - storeCreatedAt.getTime() > NEW_SUPPLIER_STORE_MS) return null

  const now = new Date()
  const weekStart = startOfUtcWeek(now)

  const rows = await prisma.order.findMany({
    where: {
      supplierId,
      status: { in: [...MARKETPLACE_COUNTABLE] },
      createdAt: { gte: weekStart, lt: now },
    },
    select: { sellingPriceCents: true },
  })

  const weekGmvCents = rows.reduce((sum, o) => sum + o.sellingPriceCents, 0)
  const progressPct = weeklyGoalProgressPct(weekGmvCents, SUPPLIER_WEEKLY_GOAL_CENTS)

  return {
    isNewStore: true,
    weekGmvCents,
    goalCents: SUPPLIER_WEEKLY_GOAL_CENTS,
    progressPct,
    filledSegments: weeklyGoalFilledSegments(progressPct),
  }
}
