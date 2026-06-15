import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import {
  computeLaunchDeliveryRatePct,
  shouldAlertLowLaunchDeliveryRate,
} from "@/lib/expansion/compute-country-delivery-rate"
import { loadExpansionFollowupDeliveryStatsByCountry } from "@/lib/expansion/load-expansion-followup-delivery-stats"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionFollowupDeliveryRateAlertResult = {
  checked: number
  alerted: number
  countries: string[]
}

function alertWeekKey(now: Date): string {
  const year = now.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getUTCDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, "0")}`
}

/** Slack/Discord when J+2 follow-up delivery rate drops below 80% (min 10 sent). */
export async function runExpansionFollowupDeliveryRateAlert(
  now = new Date()
): Promise<RunExpansionFollowupDeliveryRateAlertResult> {
  const weekKey = alertWeekKey(now)
  const [followupSentGroups, followupDeliveryStats] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchFollowUpSentAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionFollowupDeliveryStatsByCountry(now),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const row of followupSentGroups) {
    const followupDeliveredThisMonth =
      followupDeliveryStats.get(row.countryIso2)?.followupDeliveredThisMonth ?? 0
    const input = {
      deliveredThisMonth: followupDeliveredThisMonth,
      notifiedCount: row._count._all,
    }

    if (!shouldAlertLowLaunchDeliveryRate(input)) continue

    const id = `expansion:followup-delivery-rate-alert:${MARKET_REGION}:${row.countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeLaunchDeliveryRatePct(input)
    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `📬 *${countryName} (${row.countryIso2})* J+2 follow-up delivery rate *${ratePct}%* (${followupDeliveredThisMonth} delivered / ${row._count._all} sent). <${adminUrl}|Open expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "followup_delivery_rate_alert_sent",
      ratePct,
      followupDeliveredThisMonth,
      followupSentCount: row._count._all,
      slack,
      discord,
    })

    alerted += 1
    countries.push(row.countryIso2)
  }

  return { checked: followupSentGroups.length, alerted, countries }
}
