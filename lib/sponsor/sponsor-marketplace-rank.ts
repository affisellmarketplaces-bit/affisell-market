import { prisma } from "@/lib/prisma"
import { SPONSOR_STATUS } from "@/lib/sponsor/sponsor-constants"

export type SponsorBoostMap = Map<string, { boostScore: number; placement: string }>

/** listingId → boost metadata for active campaigns. */
export async function loadActiveSponsorBoostByListingId(): Promise<SponsorBoostMap> {
  const now = new Date()
  const campaigns = await prisma.sponsorCampaign.findMany({
    where: {
      status: SPONSOR_STATUS.ACTIVE,
      endsAt: { gt: now },
    },
    select: {
      boostScore: true,
      placement: true,
      affiliateProductId: true,
      productId: true,
      payerRole: true,
    },
  })

  const map: SponsorBoostMap = new Map()

  const productOnlyIds = campaigns
    .filter((c) => c.payerRole === "SUPPLIER" && !c.affiliateProductId)
    .map((c) => c.productId)

  let listingsByProduct = new Map<string, string[]>()
  if (productOnlyIds.length > 0) {
    const rows = await prisma.affiliateProduct.findMany({
      where: {
        productId: { in: [...new Set(productOnlyIds)] },
        isListed: true,
      },
      select: { id: true, productId: true },
    })
    listingsByProduct = rows.reduce((acc, row) => {
      const list = acc.get(row.productId) ?? []
      list.push(row.id)
      acc.set(row.productId, list)
      return acc
    }, new Map<string, string[]>())
  }

  for (const c of campaigns) {
    const payload = { boostScore: c.boostScore, placement: c.placement }
    if (c.affiliateProductId) {
      const prev = map.get(c.affiliateProductId)
      if (!prev || prev.boostScore < c.boostScore) {
        map.set(c.affiliateProductId, payload)
      }
      continue
    }
    const listingIds = listingsByProduct.get(c.productId) ?? []
    for (const listingId of listingIds) {
      const prev = map.get(listingId)
      if (!prev || prev.boostScore < c.boostScore) {
        map.set(listingId, payload)
      }
    }
  }

  return map
}

export function sortListingsBySponsorBoost<T extends { id: string }>(
  rows: T[],
  boostMap: SponsorBoostMap
): T[] {
  return [...rows].sort((a, b) => {
    const boostA = boostMap.get(a.id)?.boostScore ?? 0
    const boostB = boostMap.get(b.id)?.boostScore ?? 0
    if (boostB !== boostA) return boostB - boostA
    return 0
  })
}
