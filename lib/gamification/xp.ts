export const XP_PER_PRODUCT = 10
export const XP_FIRST_PRODUCT_BONUS = 50
export const STREAK_WINDOW_HOURS = 48

export type GamificationAwardResult = {
  xpGained: number
  totalXp: number
  level: number
  leveledUp: boolean
  productStreak: number
  isFirstProduct: boolean
}

/** level = max(1, floor(sqrt(xp / 100))) */
export function xpToLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)))
}

export function computeProductXpAward(args: {
  isFirstProduct: boolean
}): number {
  return args.isFirstProduct ? XP_FIRST_PRODUCT_BONUS : XP_PER_PRODUCT
}

export function computeProductStreak(args: {
  previousStreak: number
  lastPublishedAt: Date | null
  now?: Date
}): number {
  const now = args.now ?? new Date()
  if (!args.lastPublishedAt) return 1
  const elapsedMs = now.getTime() - args.lastPublishedAt.getTime()
  const windowMs = STREAK_WINDOW_HOURS * 60 * 60 * 1000
  if (elapsedMs <= windowMs) return Math.max(1, args.previousStreak + 1)
  return 1
}

export function applyXpAward(args: {
  currentXp: number
  previousStreak: number
  lastPublishedAt: Date | null
  publishedCount: number
  now?: Date
}): GamificationAwardResult {
  const isFirstProduct = args.publishedCount === 0
  const xpGained = computeProductXpAward({ isFirstProduct })
  const totalXp = Math.max(0, args.currentXp) + xpGained
  const previousLevel = xpToLevel(args.currentXp)
  const level = xpToLevel(totalXp)
  const productStreak = computeProductStreak({
    previousStreak: args.previousStreak,
    lastPublishedAt: args.lastPublishedAt,
    now: args.now,
  })

  return {
    xpGained,
    totalXp,
    level,
    leveledUp: level > previousLevel,
    productStreak,
    isFirstProduct,
  }
}
