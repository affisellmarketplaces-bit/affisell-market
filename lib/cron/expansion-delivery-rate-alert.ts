import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import {
  computeLaunchDeliveryRatePct,
  shouldAlertLowLaunchDeliveryRate,
} from "@/lib/expansion/compute-country-delivery-rate"
import { loadExpansionCountryDeliveryStats } from "@/lib/resend-webhook/expansion-email-delivered"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionDeliveryRateAlertResult = {
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

/** Slack/Discord when launch-email delivery rate drops below 80% (min 10 notified). */
export async function runExpansionDeliveryRateAlert(
  now = new Date()
): Promise<RunExpansionDeliveryRateAlertResult> {
  const weekKey = alertWeekKey(now)
  const [notifiedGroups, deliveryStats] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionCountryDeliveryStats(now),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    const deliveredThisMonth = deliveryStats.get(row.countryIso2)?.deliveredThisMonth ?? 0
    const input = {
      deliveredThisMonth,
      notifiedCount: row._count._all,
    }

    if (!shouldAlertLowLaunchDeliveryRate(input)) continue

    const id = `expansion:delivery-rate-alert:${MARKET_REGION}:${row.countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeLaunchDeliveryRatePct(input)
    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `📬 *${countryName} (${row.countryIso2})* launch-email delivery rate *${ratePct}%* (${deliveredThisMonth} delivered / ${row._count._all} notified). <${adminUrl}|Open expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "delivery_rate_alert_sent",
      ratePct,
      deliveredThisMonth,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    alerted += 1
    countries.push(row.countryIso2)
  }

  return { checked: notifiedGroups.length, alerted, countries }
}
