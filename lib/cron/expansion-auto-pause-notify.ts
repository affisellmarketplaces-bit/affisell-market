import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { shouldAutoPauseLaunchNotify } from "@/lib/expansion/expansion-auto-pause-notify"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
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

/** Auto-pause launch notify cron when delivery rate drops below 50% (min 10 notified). */
export async function runExpansionAutoPauseNotifyCron(
  now = new Date()
): Promise<RunExpansionAutoPauseNotifyResult> {
  const [notifiedGroups, deliveryStats, alreadyPaused] = await Promise.all([
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

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let paused = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    if (alreadyPaused.has(row.countryIso2.toLowerCase())) continue

    const deliveredThisMonth = deliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0
    const input = {
      deliveredThisMonth,
      notifiedCount: row._count._all,
    }

    if (!shouldAutoPauseLaunchNotify(input)) continue

    const ratePct = computeLaunchDeliveryRatePct(input)
    const didPause = await pauseLaunchNotifyCountry(
      row.countryIso2,
      `delivery_rate_${ratePct}pct`
    )
    if (!didPause) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `⏸️ *${countryName} (${row.countryIso2})* launch notify auto-paused — delivery rate *${ratePct}%*. <${adminUrl}|Resume in expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "launch_notify_auto_paused",
      ratePct,
      deliveredThisMonth,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    paused += 1
    countries.push(row.countryIso2)
  }

  return { checked: notifiedGroups.length, paused, countries }
}
