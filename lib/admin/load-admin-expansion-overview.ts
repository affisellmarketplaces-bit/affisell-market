import { resolveStripeCheckoutAllowedCountries } from "@/lib/checkout-country-rollout"
import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { visitorCountryDisplayName } from "@/lib/visitor-country"

export type ExpansionCountryRow = {
  countryIso2: string
  waitlistCount: number
  pendingNotifyCount: number
  enabled: boolean
  openedAt: string | null
  launchEmailSentAt: string | null
  firstOrderAt: string | null
  firstOrderId: string | null
}

export type AdminExpansionOverview = {
  marketRegion: MarketRegion
  liveCheckoutCount: number
  rolloutCount: number
  totalWaitlist: number
  countries: ExpansionCountryRow[]
}

export async function loadAdminExpansionOverview(): Promise<AdminExpansionOverview> {
  const marketRegion = MARKET_REGION

  const [waitlistGroups, rollouts, totalWaitlist, liveCheckoutCountries] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: { marketRegion },
      _count: { _all: true },
    }),
    prisma.checkoutCountryRollout.findMany({
      where: { marketRegion },
      orderBy: { openedAt: "desc" },
    }),
    prisma.checkoutLaunchWaitlist.count({ where: { marketRegion } }),
    resolveStripeCheckoutAllowedCountries(marketRegion),
  ])

  const pendingByCountry = await prisma.checkoutLaunchWaitlist.groupBy({
    by: ["countryIso2"],
    where: { marketRegion, launchNotifiedAt: null },
    _count: { _all: true },
  })

  const rolloutByCountry = new Map(rollouts.map((row) => [row.countryIso2, row]))
  const pendingMap = new Map(pendingByCountry.map((row) => [row.countryIso2, row._count._all]))

  const countries: ExpansionCountryRow[] = waitlistGroups
    .map((group) => {
      const rollout = rolloutByCountry.get(group.countryIso2)
      return {
        countryIso2: group.countryIso2,
        waitlistCount: group._count._all,
        pendingNotifyCount: pendingMap.get(group.countryIso2) ?? 0,
        enabled: rollout?.enabled ?? false,
        openedAt: rollout?.openedAt.toISOString() ?? null,
        launchEmailSentAt: rollout?.launchEmailSentAt?.toISOString() ?? null,
        firstOrderAt: rollout?.firstOrderAt?.toISOString() ?? null,
        firstOrderId: rollout?.firstOrderId ?? null,
      }
    })
    .sort((a, b) => b.waitlistCount - a.waitlistCount)

  return {
    marketRegion,
    liveCheckoutCount: liveCheckoutCountries.length,
    rolloutCount: rollouts.filter((row) => row.enabled).length,
    totalWaitlist,
    countries,
  }
}

export function expansionCountryLabel(countryIso2: string, locale: "en" | "fr" = "en"): string {
  return visitorCountryDisplayName(countryIso2, locale)
}
