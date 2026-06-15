import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type ExpansionCountryBounceStats = {
  retriesPending: number
  suppressed: number
}

export type ExpansionCountryBounceStatsMap = Map<string, ExpansionCountryBounceStats>

export async function loadExpansionCountryBounceStats(
  marketRegion = MARKET_REGION
): Promise<ExpansionCountryBounceStatsMap> {
  const [retriesPendingGroups, suppressedGroups] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion,
        launchEmailBouncedAt: { not: null },
        launchNotifiedAt: null,
        launchEmailSuppressedAt: null,
      },
      _count: { _all: true },
    }),
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion,
        launchEmailSuppressedAt: { not: null },
      },
      _count: { _all: true },
    }),
  ])

  const map: ExpansionCountryBounceStatsMap = new Map()

  for (const row of retriesPendingGroups) {
    map.set(row.countryIso2, {
      retriesPending: row._count._all,
      suppressed: map.get(row.countryIso2)?.suppressed ?? 0,
    })
  }

  for (const row of suppressedGroups) {
    const existing = map.get(row.countryIso2)
    map.set(row.countryIso2, {
      retriesPending: existing?.retriesPending ?? 0,
      suppressed: row._count._all,
    })
  }

  return map
}
