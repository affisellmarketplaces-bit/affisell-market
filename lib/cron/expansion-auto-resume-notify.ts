import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import { shouldAutoResumeLaunchNotify } from "@/lib/expansion/expansion-auto-resume-notify"
import {
  loadPausedLaunchNotifyCountries,
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

/** Auto-resume launch notify when delivery rate recovers to 80%+ (min 10 notified). */
export async function runExpansionAutoResumeNotifyCron(
  now = new Date()
): Promise<RunExpansionAutoResumeNotifyResult> {
  const [notifiedGroups, deliveryStats, pausedCountries] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionCountryDeliveryStats(now),
    loadPausedLaunchNotifyCountries(),
  ])

  if (pausedCountries.size === 0) {
    return { checked: 0, resumed: 0, countries: [] }
  }

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let resumed = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    if (!pausedCountries.has(row.countryIso2.toLowerCase())) continue

    const deliveredThisMonth = deliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0
    const input = {
      deliveredThisMonth,
      notifiedCount: row._count._all,
    }

    if (!shouldAutoResumeLaunchNotify(input)) continue

    const ratePct = computeLaunchDeliveryRatePct(input)
    const didResume = await resumeLaunchNotifyCountry(row.countryIso2)
    if (!didResume) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `▶️ *${countryName} (${row.countryIso2})* launch notify auto-resumed — delivery rate *${ratePct}%*. <${adminUrl}|Expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "launch_notify_auto_resumed",
      ratePct,
      deliveredThisMonth,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    resumed += 1
    countries.push(row.countryIso2)
  }

  return { checked: pausedCountries.size, resumed, countries }
}
