import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import { shouldAutoPauseLaunchNotifyOnComplaint } from "@/lib/expansion/compute-country-complaint-rate"
import { shouldAutoPauseLaunchFollowupOnDelivery } from "@/lib/expansion/expansion-auto-pause-notify"
import { loadExpansionFollowupComplaintsByCountry } from "@/lib/expansion/load-expansion-followup-complaint-stats"
import { loadExpansionFollowupDeliveryStatsByCountry } from "@/lib/expansion/load-expansion-followup-delivery-stats"
import {
  loadPausedLaunchFollowupCountries,
  pauseLaunchFollowupCountry,
} from "@/lib/expansion/launch-followup-pause"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoPauseFollowupResult = {
  checked: number
  paused: number
  countries: string[]
}

/** Auto-pause J+2 follow-up on follow-up complaint or delivery rate <50% (min 10 sent). */
export async function runExpansionAutoPauseFollowupCron(
  now = new Date()
): Promise<RunExpansionAutoPauseFollowupResult> {
  const [followupSentGroups, followupComplaints, followupDeliveryStats, alreadyPaused] =
    await Promise.all([
      prisma.checkoutLaunchWaitlist.groupBy({
        by: ["countryIso2"],
        where: {
          marketRegion: MARKET_REGION,
          launchFollowUpSentAt: { not: null },
        },
        _count: { _all: true },
      }),
      loadExpansionFollowupComplaintsByCountry(now),
      loadExpansionFollowupDeliveryStatsByCountry(now),
      loadPausedLaunchFollowupCountries(),
    ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let paused = 0
  const countries: string[] = []

  for (const row of followupSentGroups) {
    const countryKey = row.countryIso2.toLowerCase()
    if (alreadyPaused.has(countryKey)) continue

    const followupSentCount = row._count._all
    const followupComplaintsThisMonth = followupComplaints.get(countryKey) ?? 0
    const followupDeliveredThisMonth =
      followupDeliveryStats.get(row.countryIso2)?.followupDeliveredThisMonth ?? 0

    const pauseOnComplaint = shouldAutoPauseLaunchNotifyOnComplaint({
      complaintsThisMonth: followupComplaintsThisMonth,
      notifiedCount: followupSentCount,
    })
    const pauseOnDelivery = shouldAutoPauseLaunchFollowupOnDelivery({
      followupDeliveredThisMonth,
      followupSentCount,
    })

    if (!pauseOnComplaint && !pauseOnDelivery) continue

    const deliveryRatePct = computeLaunchDeliveryRatePct({
      deliveredThisMonth: followupDeliveredThisMonth,
      notifiedCount: followupSentCount,
    })
    const reason = pauseOnComplaint
      ? `followup_complaint_${followupComplaintsThisMonth}`
      : `followup_delivery_rate_${deliveryRatePct}pct`

    const didPause = await pauseLaunchFollowupCountry(row.countryIso2, reason)
    if (!didPause) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = pauseOnComplaint
      ? `⏸️ *${countryName} (${row.countryIso2})* J+2 follow-up auto-paused — *${followupComplaintsThisMonth} follow-up complaint(s)*. <${adminUrl}|Resume in expansion console>`
      : `⏸️ *${countryName} (${row.countryIso2})* J+2 follow-up auto-paused — delivery rate *${deliveryRatePct}%*. <${adminUrl}|Resume in expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: pauseOnComplaint
        ? "launch_followup_auto_paused_complaint"
        : "launch_followup_auto_paused_delivery",
      followupComplaintsThisMonth,
      deliveryRatePct,
      followupDeliveredThisMonth,
      followupSentCount,
      slack,
      discord,
    })

    paused += 1
    countries.push(row.countryIso2)
  }

  return { checked: followupSentGroups.length, paused, countries }
}
