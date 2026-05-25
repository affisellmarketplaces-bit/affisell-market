/** Weekly goal constants + pure helpers (no Prisma — safe for client UI). */

export const SUPPLIER_WEEKLY_GOAL_CENTS = 50_000
export const NEW_SUPPLIER_STORE_MS = 90 * 24 * 60 * 60 * 1000
export const WEEKLY_GOAL_BAR_SEGMENTS = 10

export type SupplierWeeklyGoalSnapshot = {
  isNewStore: true
  weekGmvCents: number
  goalCents: number
  progressPct: number
  filledSegments: number
}

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

export function weeklyGoalFilledSegments(
  progressPct: number,
  segments = WEEKLY_GOAL_BAR_SEGMENTS
): number {
  return Math.min(segments, Math.max(0, Math.round((progressPct / 100) * segments)))
}
