import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import { shouldAutoResumeLaunchNotify } from "@/lib/expansion/expansion-auto-resume-notify"
import {
  expansionComplaintClearCutoff,
  shouldAutoResumeLaunchNotifyAfterComplaintClear,
} from "@/lib/expansion/expansion-complaint-clear-window"
import { loadExpansionCountryComplaintsSince } from "@/lib/expansion/load-expansion-country-complaints-since"
import {
  loadPausedLaunchNotifyDetails,
  resumeLaunchNotifyCountry,
} from "@/lib/expansion/launch-notify-pause"
import { loadExpansionCountryDeliveryStats } from "@/lib/resend-webhook/expansion-email-delivered"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoResumeNotifyResult = {
  checked: number
  resumed: number
  countries: string[]
}

/** Auto-resume launch notify when delivery recovers to 80%+ or complaint window clear (30d). */
export async function runExpansionAutoResumeNotifyCron(
  now = new Date()
): Promise<RunExpansionAutoResumeNotifyResult> {
  const complaintCutoff = expansionComplaintClearCutoff(now)
  const [notifiedGroups, deliveryStats, pausedDetails, complaintsSinceCutoff] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionCountryDeliveryStats(now),
    loadPausedLaunchNotifyDetails(),
    loadExpansionCountryComplaintsSince(complaintCutoff),
  ])

  if (pausedDetails.size === 0) {
    return { checked: 0, resumed: 0, countries: [] }
  }

  const pausedCountries = new Set(pausedDetails.keys())

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let resumed = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    const countryKey = row.countryIso2.toLowerCase()
    if (!pausedCountries.has(countryKey)) continue

    const pausedReason = pausedDetails.get(countryKey)?.reason ?? null
    const complaintsSinceCutoffCount = complaintsSinceCutoff.get(countryKey) ?? 0
    const deliveredThisMonth = deliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0
    const deliveryInput = {
      deliveredThisMonth,
      notifiedCount: row._count._all,
    }

    const resumeOnDelivery = shouldAutoResumeLaunchNotify(deliveryInput)
    const resumeOnComplaintClear = shouldAutoResumeLaunchNotifyAfterComplaintClear({
      complaintsSinceCutoff: complaintsSinceCutoffCount,
      pausedReason,
    })

    if (!resumeOnDelivery && !resumeOnComplaintClear) continue

    const ratePct = computeLaunchDeliveryRatePct(deliveryInput)
    const didResume = await resumeLaunchNotifyCountry(row.countryIso2)
    if (!didResume) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = resumeOnComplaintClear
      ? `▶️ *${countryName} (${row.countryIso2})* launch notify auto-resumed — no complaints in 30 days. <${adminUrl}|Expansion console>`
      : `▶️ *${countryName} (${row.countryIso2})* launch notify auto-resumed — delivery rate *${ratePct}%*. <${adminUrl}|Expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: resumeOnComplaintClear
        ? "launch_notify_auto_resumed_complaint_clear"
        : "launch_notify_auto_resumed",
      ratePct,
      deliveredThisMonth,
      complaintsSinceCutoff: complaintsSinceCutoffCount,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    resumed += 1
    countries.push(row.countryIso2)
  }

  return { checked: pausedCountries.size, resumed, countries }
}
