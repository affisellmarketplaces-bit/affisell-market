import { prisma } from "@/lib/prisma"

/** Cancel active arena lots tied to specific affiliate listings. */
export async function cancelAuctionsForListings(listingIds: string[]): Promise<number> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))].slice(0, 200)
  if (ids.length === 0) return 0

  const now = new Date()
  const result = await prisma.auction.updateMany({
    where: {
      listingId: { in: ids },
      status: { in: ["LIVE", "SCHEDULED"] },
      endsAt: { gt: now },
    },
    data: { status: "CANCELLED" },
  })

  if (result.count > 0) {
    console.log("[auction-lifecycle]", { listingIds: ids.length, cancelled: result.count })
  }
  return result.count
}

/** Drop live lots whose listing was unlisted or opted out of the arena. */
export async function retireIneligibleAuctionLots(now: Date = new Date()): Promise<number> {
  const liveWithListing = await prisma.auction.findMany({
    where: {
      status: { in: ["LIVE", "SCHEDULED"] },
      endsAt: { gt: now },
      listingId: { not: null },
    },
    select: { listingId: true },
    take: 64,
  })

  const listingIds = [
    ...new Set(
      liveWithListing
        .map((row) => row.listingId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]
  if (listingIds.length === 0) return 0

  const ineligible = await prisma.affiliateProduct.findMany({
    where: {
      id: { in: listingIds },
      OR: [{ auctionEligible: false }, { isListed: false }],
    },
    select: { id: true },
  })

  return cancelAuctionsForListings(ineligible.map((row) => row.id))
}
