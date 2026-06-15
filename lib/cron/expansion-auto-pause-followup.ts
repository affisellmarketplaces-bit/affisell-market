import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { loadExpansionFollowupComplaintsByCountry } from "@/lib/expansion/load-expansion-followup-complaint-stats"
import {
  loadPausedLaunchFollowupCountries,
  pauseLaunchFollowupCountry,
} from "@/lib/expansion/launch-followup-pause"
import { shouldAutoPauseLaunchNotifyOnComplaint } from "@/lib/expansion/compute-country-complaint-rate"
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

/** Auto-pause J+2 follow-up when a follow-up email complaint is recorded (min 10 notified). */
export async function runExpansionAutoPauseFollowupCron(
  now = new Date()
): Promise<RunExpansionAutoPauseFollowupResult> {
  const [notifiedGroups, followupComplaints, alreadyPaused] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionFollowupComplaintsByCountry(now),
    loadPausedLaunchFollowupCountries(),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let paused = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    if (alreadyPaused.has(row.countryIso2.toLowerCase())) continue

    const followupComplaintsThisMonth = followupComplaints.get(row.countryIso2.toLowerCase()) ?? 0
    const input = {
      complaintsThisMonth: followupComplaintsThisMonth,
      notifiedCount: row._count._all,
    }

    if (!shouldAutoPauseLaunchNotifyOnComplaint(input)) continue

    const didPause = await pauseLaunchFollowupCountry(
      row.countryIso2,
      `followup_complaint_${followupComplaintsThisMonth}`
    )
    if (!didPause) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `⏸️ *${countryName} (${row.countryIso2})* J+2 follow-up auto-paused — *${followupComplaintsThisMonth} follow-up complaint(s)*. <${adminUrl}|Resume in expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "launch_followup_auto_paused",
      followupComplaintsThisMonth,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    paused += 1
    countries.push(row.countryIso2)
  }

  return { checked: notifiedGroups.length, paused, countries }
}
