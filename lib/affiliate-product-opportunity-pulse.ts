import { prisma } from "@/lib/prisma"

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

/** Distinct affiliates who viewed this product SKU in the last 7 days (Pulse / PDP tracking). */
export async function countAffiliateCreatorsWatchingProduct(productId: string): Promise<number> {
  const id = productId.trim()
  if (!id) return 0

  try {
    const since = new Date(Date.now() - LOOKBACK_MS)
    const viewers = await prisma.affisellTrackEvent.findMany({
      where: {
        eventType: "view",
        productId: id,
        userId: { not: null },
        createdAt: { gte: since },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 200,
    })

    const userIds = viewers
      .map((row) => row.userId)
      .filter((uid): uid is string => typeof uid === "string" && Boolean(uid.trim()))

    if (userIds.length === 0) return 0

    return prisma.user.count({
      where: {
        id: { in: userIds },
        role: "AFFILIATE",
      },
    })
  } catch (error) {
    console.warn("[affiliate-opportunity-pulse]", {
      productId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
