import { prisma } from "@/lib/prisma"
import {
  NEW_SUPPLIER_STORE_MS,
  startOfUtcWeek,
  SUPPLIER_WEEKLY_GOAL_CENTS,
  weeklyGoalFilledSegments,
  weeklyGoalProgressPct,
  type SupplierWeeklyGoalSnapshot,
} from "@/lib/supplier-weekly-goal-shared"

export {
  NEW_SUPPLIER_STORE_MS,
  startOfUtcWeek,
  SUPPLIER_WEEKLY_GOAL_CENTS,
  weeklyGoalFilledSegments,
  weeklyGoalProgressPct,
  WEEKLY_GOAL_BAR_SEGMENTS,
  type SupplierWeeklyGoalSnapshot,
} from "@/lib/supplier-weekly-goal-shared"

const MARKETPLACE_COUNTABLE = ["paid", "preparing", "shipped", "refunded"] as const

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
    select: { supplierPriceCents: true, basePriceCents: true },
  })

  const weekGmvCents = rows.reduce(
    (sum, o) => sum + Math.max(0, o.supplierPriceCents ?? o.basePriceCents),
    0
  )
  const progressPct = weeklyGoalProgressPct(weekGmvCents, SUPPLIER_WEEKLY_GOAL_CENTS)

  return {
    isNewStore: true,
    weekGmvCents,
    goalCents: SUPPLIER_WEEKLY_GOAL_CENTS,
    progressPct,
    filledSegments: weeklyGoalFilledSegments(progressPct),
  }
}
