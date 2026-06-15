import { resolveStripeCheckoutAllowedCountries } from "@/lib/checkout-country-rollout"
import type { AdminExpansionOverview, ExpansionCountryRow } from "@/lib/admin/admin-expansion-types"
import {
  loadExpansionCountryFunnels,
  loadExpansionFunnelSummary,
} from "@/lib/admin/load-admin-expansion-funnel"
import { loadExpansionRolloutHealthStats } from "@/lib/admin/load-expansion-rollout-health"
import { isExpansionAutoPilotEnabled } from "@/lib/cron/expansion-auto-pilot"
import { MARKET_REGION } from "@/lib/market-config"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import { loadGraduatedCheckoutCountryIso2 } from "@/lib/checkout-country-rollout"
import { findNextPilotCountry } from "@/lib/expansion/find-next-pilot-country"
import { computeCountryBounceRatePct } from "@/lib/expansion/compute-country-bounce-rate"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import { expansionCountryLabel } from "@/lib/expansion/expansion-country-label"
import { computeCountryComplaintRatePct } from "@/lib/expansion/compute-country-complaint-rate"
import { loadExpansionCountryBounceStats } from "@/lib/expansion/load-expansion-country-bounce-stats"
import { loadExpansionCountryComplaintStats } from "@/lib/expansion/load-expansion-country-complaint-stats"
import { loadExpansionGraduatedComplaintsByCountry } from "@/lib/expansion/load-expansion-country-complaints-since"
import { loadExpansionCountryDeliveryStats } from "@/lib/resend-webhook/expansion-email-delivered"
import { loadExpansionEmailKindStats } from "@/lib/expansion/load-expansion-email-kind-stats"
import { loadExpansionEmailEventCounts } from "@/lib/expansion/load-expansion-email-event-counts"
import { loadLastExpansionOrderIdsByCountry } from "@/lib/admin/load-last-expansion-order-by-country"
import { loadPausedGraduationEmailCountries } from "@/lib/expansion/graduation-email-pause"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import { loadExpansionFollowupComplaintsByCountry } from "@/lib/expansion/load-expansion-followup-complaint-stats"
import { loadExpansionFollowupDeliveryStatsByCountry } from "@/lib/expansion/load-expansion-followup-delivery-stats"
import { loadPausedLaunchFollowupCountries } from "@/lib/expansion/launch-followup-pause"
import { loadPausedLaunchNotifyCountries } from "@/lib/expansion/launch-notify-pause"
import { prisma } from "@/lib/prisma"

export type {
  AdminExpansionOverview,
  ExpansionCountryRow,
  ExpansionEmailBounceOverview,
  ExpansionEmailEventCounts,
  ExpansionEmailKindStat,
  ExpansionNextPilot,
  GraduatedThisMonthCountry,
} from "@/lib/admin/admin-expansion-types"
export { expansionCountryLabel }

export async function loadAdminExpansionOverview(): Promise<AdminExpansionOverview> {
  const marketRegion = MARKET_REGION

  const [waitlistGroups, rollouts, totalWaitlist, liveCheckoutCountries, funnel, rolloutHealth, emailBounces, countryBounceStats, countryDeliveryStats, countryComplaintStats, graduatedComplaintStats, followupComplaintStats, followupDeliveryStats, graduatedEmailStats, emailKindStats, emailEventCounts, pausedNotifyCountries, pausedFollowupCountries, pausedGraduationCountries] =
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
    loadExpansionEmailBounceStats(),
    loadExpansionCountryBounceStats(),
    loadExpansionCountryDeliveryStats(),
    loadExpansionCountryComplaintStats(),
    loadExpansionGraduatedComplaintsByCountry(),
    loadExpansionFollowupComplaintsByCountry(),
    loadExpansionFollowupDeliveryStatsByCountry(),
    loadExpansionGraduatedEmailStatsByCountry(),
    loadExpansionEmailKindStats(),
    loadExpansionEmailEventCounts(),
    loadPausedLaunchNotifyCountries(),
    loadPausedLaunchFollowupCountries(),
    loadPausedGraduationEmailCountries(),
  ])

  const pendingByCountry = await prisma.checkoutLaunchWaitlist.groupBy({
    by: ["countryIso2"],
    where: { marketRegion, launchNotifiedAt: null, launchEmailSuppressedAt: null },
    _count: { _all: true },
  })

  const rolloutByCountry = new Map(rollouts.map((row) => [row.countryIso2, row]))
  const pendingMap = new Map(pendingByCountry.map((row) => [row.countryIso2, row._count._all]))

  const lastOrderLookupCountries = waitlistGroups
    .map((group) => rolloutByCountry.get(group.countryIso2))
    .filter((rollout) => rollout?.graduatedAt && !rollout.firstOrderId)
    .map((rollout) => rollout!.countryIso2)
  const lastOrderIdsByCountry = await loadLastExpansionOrderIdsByCountry(lastOrderLookupCountries)

  const countriesBase: Omit<ExpansionCountryRow, "funnel">[] = waitlistGroups
    .map((group) => {
      const rollout = rolloutByCountry.get(group.countryIso2)
      const bounceStats = countryBounceStats.get(group.countryIso2)
      const retriesPending = bounceStats?.retriesPending ?? 0
      const suppressed = bounceStats?.suppressed ?? 0
      return {
        countryIso2: group.countryIso2,
        waitlistCount: group._count._all,
        pendingNotifyCount: pendingMap.get(group.countryIso2) ?? 0,
        enabled: rollout?.enabled ?? false,
        openedAt: rollout?.openedAt.toISOString() ?? null,
        launchEmailSentAt: rollout?.launchEmailSentAt?.toISOString() ?? null,
        firstOrderAt: rollout?.firstOrderAt?.toISOString() ?? null,
        firstOrderId: rollout?.firstOrderId ?? null,
        graduationLastOrderId:
          lastOrderIdsByCountry.get(group.countryIso2.toLowerCase()) ?? null,
        graduatedAt: rollout?.graduatedAt?.toISOString() ?? null,
        graduationEmailSentAt: rollout?.graduationEmailSentAt?.toISOString() ?? null,
        launchBounceRetriesPending: retriesPending,
        launchBounceSuppressed: suppressed,
        launchBounceRatePct: 0,
        launchEmailsDeliveredThisMonth: 0,
        launchDeliveryRatePct: 0,
        launchComplaintsThisMonth: 0,
        launchComplaintRatePct: 0,
        launchGraduatedComplaintsThisMonth: 0,
        launchFollowupComplaintsThisMonth: 0,
        launchFollowupDeliveredThisMonth: 0,
        launchFollowupDeliveryRatePct: 0,
        launchGraduatedDeliveredThisMonth: 0,
        launchGraduatedDeliveryRatePct: 0,
        graduationEmailPaused: pausedGraduationCountries.has(group.countryIso2.toLowerCase()),
        launchNotifyPaused: pausedNotifyCountries.has(group.countryIso2.toLowerCase()),
        launchFollowupPaused: pausedFollowupCountries.has(group.countryIso2.toLowerCase()),
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

  const countries: ExpansionCountryRow[] = countriesBase.map((row) => {
    const funnel =
      funnelByCountry.get(row.countryIso2) ?? {
        countryIso2: row.countryIso2,
        notifiedCount: 0,
        followUpCount: 0,
        paidOrdersSinceOpen: 0,
        notifyRatePct: 0,
        orderRatePct: 0,
      }

    return {
      ...row,
      funnel,
      launchBounceRatePct: computeCountryBounceRatePct({
        notifiedCount: funnel.notifiedCount,
        retriesPending: row.launchBounceRetriesPending,
        suppressed: row.launchBounceSuppressed,
      }),
      launchEmailsDeliveredThisMonth:
        countryDeliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0,
      launchDeliveryRatePct: computeLaunchDeliveryRatePct({
        deliveredThisMonth:
          countryDeliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0,
        notifiedCount: funnel.notifiedCount,
      }),
      launchComplaintsThisMonth:
        countryComplaintStats.get(row.countryIso2)?.complaintsThisMonth ?? 0,
      launchComplaintRatePct: computeCountryComplaintRatePct({
        complaintsThisMonth:
          countryComplaintStats.get(row.countryIso2)?.complaintsThisMonth ?? 0,
        notifiedCount: funnel.notifiedCount,
      }),
      launchGraduatedComplaintsThisMonth:
        graduatedComplaintStats.get(row.countryIso2.toLowerCase()) ?? 0,
      launchFollowupComplaintsThisMonth:
        followupComplaintStats.get(row.countryIso2.toLowerCase()) ?? 0,
      launchFollowupDeliveredThisMonth:
        followupDeliveryStats.get(row.countryIso2)?.followupDeliveredThisMonth ?? 0,
      launchFollowupDeliveryRatePct: computeLaunchDeliveryRatePct({
        deliveredThisMonth:
          followupDeliveryStats.get(row.countryIso2)?.followupDeliveredThisMonth ?? 0,
        notifiedCount: funnel.followUpCount,
      }),
      launchGraduatedDeliveredThisMonth:
        graduatedEmailStats.get(row.countryIso2.toLowerCase())?.deliveredThisMonth ?? 0,
      launchGraduatedDeliveryRatePct: computeLaunchDeliveryRatePct({
        deliveredThisMonth:
          graduatedEmailStats.get(row.countryIso2.toLowerCase())?.deliveredThisMonth ?? 0,
        notifiedCount: graduatedEmailStats.get(row.countryIso2.toLowerCase())?.sentCount ?? 0,
      }),
    }
  })

  const enabledSet = new Set(
    rollouts.filter((row) => row.enabled).map((row) => row.countryIso2.toUpperCase())
  )
  const graduated = await loadGraduatedCheckoutCountryIso2(marketRegion)
  const baseSet = new Set([
    ...stripeCheckoutAllowedCountriesForRegion(marketRegion).map((code) => code.toUpperCase()),
    ...graduated,
  ])
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

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const graduatedThisMonth = rollouts.filter(
    (row) => row.graduatedAt && row.graduatedAt >= monthStart
  ).length
  const graduatedThisMonthCountries: GraduatedThisMonthCountry[] = rollouts
    .filter((row) => row.graduatedAt && row.graduatedAt >= monthStart)
    .map((row) => ({
      countryIso2: row.countryIso2,
      graduatedAt: row.graduatedAt!.toISOString(),
    }))
    .sort((a, b) => b.graduatedAt.localeCompare(a.graduatedAt))

  return {
    marketRegion,
    liveCheckoutCount: liveCheckoutCountries.length,
    rolloutCount: rollouts.filter((row) => row.enabled).length,
    graduatedCount: rollouts.filter((row) => row.enabled && row.graduatedAt).length,
    graduatedThisMonth,
    graduatedThisMonthCountries,
    emailBounces,
    emailKindStats,
    emailEventCounts,
    totalWaitlist,
    funnel,
    nextPilot,
    rolloutHealth,
    autoPilotEnabled: isExpansionAutoPilotEnabled(),
    countries,
  }
}
