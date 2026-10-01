import { prisma } from "@/lib/prisma"

export type GrowthPlanRankMap = Map<string, number>

const GROWTH_PLAN_RANK: Record<string, number> = { empire: 2, dominator: 1 }

/**
 * Emergency pause for the Growth ranking tie-breaker (default ON / enforced).
 * Set `GROWTH_RANK_BOOST_PAUSED=1` to disable in prod without a redeploy if it misfires.
 */
export function isGrowthRankBoostPaused(): boolean {
  const raw = process.env.GROWTH_RANK_BOOST_PAUSED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

/**
 * listingId (AffiliateProduct.id) → rank (empire=2, dominator=1, else absent/0), resolved via
 * the listing's supplier's Growth plan. Scoped to the given listing ids — this runs after the
 * page's listings are already fetched, so there's no need to scan the whole marketplace.
 */
export async function loadGrowthPlanRankByListingId(listingIds: string[]): Promise<GrowthPlanRankMap> {
  const map: GrowthPlanRankMap = new Map()
  if (listingIds.length === 0 || isGrowthRankBoostPaused()) return map

  const rows = await prisma.affiliateProduct.findMany({
    where: { id: { in: listingIds }, product: { supplier: { growthPlan: { in: ["dominator", "empire"] } } } },
    select: { id: true, product: { select: { supplier: { select: { growthPlan: true } } } } },
  })

  for (const row of rows) {
    const rank = GROWTH_PLAN_RANK[row.product.supplier.growthPlan] ?? 0
    if (rank > 0) map.set(row.id, rank)
  }

  return map
}

/** Stable tie-breaker: Growth plan rank only decides ties left by sponsorScore (never outranks a paying Sponsor campaign). */
export function sortListingsByGrowthPlanThenSponsorBoost<T extends { id: string }>(
  rows: T[],
  sponsorScoreByListingId: Map<string, number>,
  growthRankByListingId: GrowthPlanRankMap
): T[] {
  return [...rows].sort((a, b) => {
    const sponsorA = sponsorScoreByListingId.get(a.id) ?? 0
    const sponsorB = sponsorScoreByListingId.get(b.id) ?? 0
    if (sponsorB !== sponsorA) return sponsorB - sponsorA

    const rankA = growthRankByListingId.get(a.id) ?? 0
    const rankB = growthRankByListingId.get(b.id) ?? 0
    return rankB - rankA
  })
}
