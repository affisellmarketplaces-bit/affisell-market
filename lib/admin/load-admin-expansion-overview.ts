import { resolveStripeCheckoutAllowedCountries } from "@/lib/checkout-country-rollout"
import type { ExpansionCountryFunnel, ExpansionFunnelSummary } from "@/lib/admin/load-admin-expansion-funnel"
import {
  loadExpansionCountryFunnels,
  loadExpansionFunnelSummary,
} from "@/lib/admin/load-admin-expansion-funnel"
import type { ExpansionRolloutHealthStats } from "@/lib/admin/load-expansion-rollout-health"
import { loadExpansionRolloutHealthStats } from "@/lib/admin/load-expansion-rollout-health"
import { isExpansionAutoPilotEnabled } from "@/lib/cron/expansion-auto-pilot"
import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import { findNextPilotCountry } from "@/lib/expansion/find-next-pilot-country"
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
  funnel: ExpansionCountryFunnel
}

export type ExpansionNextPilot = {
  rank: number
  countryIso2: string
  waitlistCount: number
}

export type AdminExpansionOverview = {
  marketRegion: MarketRegion
  liveCheckoutCount: number
  rolloutCount: number
  totalWaitlist: number
  funnel: ExpansionFunnelSummary
  nextPilot: ExpansionNextPilot | null
  rolloutHealth: ExpansionRolloutHealthStats
  autoPilotEnabled: boolean
  countries: ExpansionCountryRow[]
}

export async function loadAdminExpansionOverview(): Promise<AdminExpansionOverview> {
  const marketRegion = MARKET_REGION

  const [waitlistGroups, rollouts, totalWaitlist, liveCheckoutCountries, funnel, rolloutHealth] =
    await Promise.all([
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
    loadExpansionFunnelSummary(),
    loadExpansionRolloutHealthStats(),
  ])

  const pendingByCountry = await prisma.checkoutLaunchWaitlist.groupBy({
    by: ["countryIso2"],
    where: { marketRegion, launchNotifiedAt: null },
    _count: { _all: true },
  })

  const rolloutByCountry = new Map(rollouts.map((row) => [row.countryIso2, row]))
  const pendingMap = new Map(pendingByCountry.map((row) => [row.countryIso2, row._count._all]))

  const countriesBase: Omit<ExpansionCountryRow, "funnel">[] = waitlistGroups
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

  const funnelByCountry = await loadExpansionCountryFunnels(
    countriesBase.map((row) => ({
      countryIso2: row.countryIso2,
      waitlistCount: row.waitlistCount,
      openedAt: row.openedAt,
    }))
  )

  const countries: ExpansionCountryRow[] = countriesBase.map((row) => ({
    ...row,
    funnel: funnelByCountry.get(row.countryIso2) ?? {
      countryIso2: row.countryIso2,
      notifiedCount: 0,
      followUpCount: 0,
      paidOrdersSinceOpen: 0,
      notifyRatePct: 0,
      orderRatePct: 0,
    },
  }))

  const enabledSet = new Set(
    rollouts.filter((row) => row.enabled).map((row) => row.countryIso2.toUpperCase())
  )
  const baseSet = new Set(
    stripeCheckoutAllowedCountriesForRegion(marketRegion).map((code) => code.toUpperCase())
  )
  const waitlistDemand = waitlistGroups.map((group) => ({
    countryIso2: group.countryIso2,
    waitlistCount: group._count._all,
  }))

  let nextPilot: ExpansionNextPilot | null = null
  const candidate = findNextPilotCountry(waitlistDemand, enabledSet, baseSet, 1)
  if (candidate) {
    nextPilot = {
      rank: 1,
      countryIso2: candidate.countryIso2,
      waitlistCount: candidate.waitlistCount,
    }
  }

  return {
    marketRegion,
    liveCheckoutCount: liveCheckoutCountries.length,
    rolloutCount: rollouts.filter((row) => row.enabled).length,
    totalWaitlist,
    funnel,
    nextPilot,
    rolloutHealth,
    autoPilotEnabled: isExpansionAutoPilotEnabled(),
    countries,
  }
}

export function expansionCountryLabel(countryIso2: string, locale: "en" | "fr" = "en"): string {
  return visitorCountryDisplayName(countryIso2, locale)
}
