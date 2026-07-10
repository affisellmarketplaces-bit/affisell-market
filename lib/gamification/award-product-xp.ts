import "server-only"

import { applyXpAward } from "@/lib/gamification/xp"
import { prisma } from "@/lib/prisma"

export async function awardProductPublishXp(userId: string): Promise<{
  xpGained: number
  totalXp: number
  level: number
  leveledUp: boolean
  productStreak: number
  isFirstProduct: boolean
}> {
  const [user, publishedCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, productStreak: true, lastProductPublishedAt: true },
    }),
    prisma.product.count({
      where: { supplierId: userId, isDraft: false, active: true },
    }),
  ])

  if (!user) {
    throw new Error("user_not_found")
  }

  const isFirstProduct = publishedCount <= 1
  const award = applyXpAward({
    currentXp: user.xp,
    previousStreak: user.productStreak,
    lastPublishedAt: user.lastProductPublishedAt,
    publishedCount: isFirstProduct ? 0 : publishedCount,
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: award.totalXp,
      productStreak: award.productStreak,
      lastProductPublishedAt: new Date(),
    },
  })

  console.log("[gamification]", {
    userId,
    xpGained: award.xpGained,
    level: award.level,
    productStreak: award.productStreak,
    isFirstProduct: award.isFirstProduct,
  })

  return award
}
