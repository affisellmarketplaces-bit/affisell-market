import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { shouldAutoPauseLaunchNotify } from "@/lib/expansion/expansion-auto-pause-notify"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import {
  computeCountryComplaintRatePct,
  shouldAutoPauseLaunchNotifyOnComplaint,
} from "@/lib/expansion/compute-country-complaint-rate"
import { loadExpansionCountryComplaintStats } from "@/lib/expansion/load-expansion-country-complaint-stats"
import {
  loadPausedLaunchNotifyCountries,
  pauseLaunchNotifyCountry,
} from "@/lib/expansion/launch-notify-pause"
import { loadExpansionCountryDeliveryStats } from "@/lib/resend-webhook/expansion-email-delivered"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoPauseNotifyResult = {
  checked: number
  paused: number
  countries: string[]
}

/** Auto-pause launch notify when delivery rate drops below 50% or complaint received (min 10 notified). */
export async function runExpansionAutoPauseNotifyCron(
  now = new Date()
): Promise<RunExpansionAutoPauseNotifyResult> {
  const [notifiedGroups, deliveryStats, complaintStats, alreadyPaused] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionCountryDeliveryStats(now),
    loadExpansionCountryComplaintStats(now),
    loadPausedLaunchNotifyCountries(),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let paused = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    if (alreadyPaused.has(row.countryIso2.toLowerCase())) continue

    const deliveredThisMonth = deliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0
    const complaintsThisMonth = complaintStats.get(row.countryIso2)?.complaintsThisMonth ?? 0
    const notifiedCount = row._count._all
    const deliveryInput = {
      deliveredThisMonth,
      notifiedCount,
    }
    const complaintInput = {
      complaintsThisMonth,
      notifiedCount,
    }

    const pauseOnDelivery = shouldAutoPauseLaunchNotify(deliveryInput)
    const pauseOnComplaint = shouldAutoPauseLaunchNotifyOnComplaint(complaintInput)

    if (!pauseOnDelivery && !pauseOnComplaint) continue

    const deliveryRatePct = computeLaunchDeliveryRatePct(deliveryInput)
    const complaintRatePct = computeCountryComplaintRatePct(complaintInput)
    const reason = pauseOnComplaint
      ? `complaint_${complaintsThisMonth}_rate_${complaintRatePct}pct`
      : `delivery_rate_${deliveryRatePct}pct`

    const didPause = await pauseLaunchNotifyCountry(row.countryIso2, reason)
    if (!didPause) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = pauseOnComplaint
      ? `⏸️ *${countryName} (${row.countryIso2})* launch notify auto-paused — *${complaintsThisMonth} complaint(s)* (${complaintRatePct}% of notified). <${adminUrl}|Resume in expansion console>`
      : `⏸️ *${countryName} (${row.countryIso2})* launch notify auto-paused — delivery rate *${deliveryRatePct}%*. <${adminUrl}|Resume in expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: pauseOnComplaint ? "launch_notify_auto_paused_complaint" : "launch_notify_auto_paused",
      deliveryRatePct,
      complaintRatePct,
      complaintsThisMonth,
      deliveredThisMonth,
      notifiedCount,
      slack,
      discord,
    })

    paused += 1
    countries.push(row.countryIso2)
  }

  return { checked: notifiedGroups.length, paused, countries }
}
