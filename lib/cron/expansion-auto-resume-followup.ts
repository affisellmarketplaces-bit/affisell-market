import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import {
  expansionComplaintClearCutoff,
  shouldAutoResumeLaunchFollowupAfterComplaintClear,
} from "@/lib/expansion/expansion-complaint-clear-window"
import { loadExpansionFollowupComplaintsSince } from "@/lib/expansion/load-expansion-country-complaints-since"
import {
  loadPausedLaunchFollowupDetails,
  resumeLaunchFollowupCountry,
} from "@/lib/expansion/launch-followup-pause"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoResumeFollowupResult = {
  checked: number
  resumed: number
  countries: string[]
}

/** Auto-resume J+2 follow-up when no follow-up complaints in 30 days. */
export async function runExpansionAutoResumeFollowupCron(
  now = new Date()
): Promise<RunExpansionAutoResumeFollowupResult> {
  const complaintCutoff = expansionComplaintClearCutoff(now)
  const [notifiedGroups, pausedDetails, followupComplaintsSinceCutoff] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadPausedLaunchFollowupDetails(),
    loadExpansionFollowupComplaintsSince(complaintCutoff),
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
    const followupComplaintsSinceCutoffCount = followupComplaintsSinceCutoff.get(countryKey) ?? 0

    if (
      !shouldAutoResumeLaunchFollowupAfterComplaintClear({
        followupComplaintsSinceCutoff: followupComplaintsSinceCutoffCount,
        pausedReason,
      })
    ) {
      continue
    }

    const didResume = await resumeLaunchFollowupCountry(row.countryIso2)
    if (!didResume) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `▶️ *${countryName} (${row.countryIso2})* J+2 follow-up auto-resumed — no follow-up complaints in 30 days. <${adminUrl}|Expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "launch_followup_auto_resumed_complaint_clear",
      followupComplaintsSinceCutoff: followupComplaintsSinceCutoffCount,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    resumed += 1
    countries.push(row.countryIso2)
  }

  return { checked: pausedCountries.size, resumed, countries }
}
