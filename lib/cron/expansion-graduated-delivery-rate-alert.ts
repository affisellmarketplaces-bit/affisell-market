import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import {
  computeLaunchDeliveryRatePct,
  shouldAlertLowLaunchDeliveryRate,
} from "@/lib/expansion/compute-country-delivery-rate"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionGraduatedDeliveryRateAlertResult = {
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

/** Slack/Discord when graduation email delivery rate drops below 80% (min 10 sent). */
export async function runExpansionGraduatedDeliveryRateAlert(
  now = new Date()
): Promise<RunExpansionGraduatedDeliveryRateAlertResult> {
  const weekKey = alertWeekKey(now)
  const graduatedStats = await loadExpansionGraduatedEmailStatsByCountry(now)

  if (graduatedStats.size === 0) {
    return { checked: 0, alerted: 0, countries: [] }
  }

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const [countryIso2, stats] of graduatedStats) {
    const input = {
      deliveredThisMonth: stats.deliveredThisMonth,
      notifiedCount: stats.sentCount,
    }

    if (!shouldAlertLowLaunchDeliveryRate(input)) continue

    const id = `expansion:graduated-delivery-rate-alert:${MARKET_REGION}:${countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeLaunchDeliveryRatePct(input)
    const countryName = expansionCountryLabel(countryIso2, "en")
    const text = `🎓📬 *${countryName} (${countryIso2})* graduation email delivery rate *${ratePct}%* (${stats.deliveredThisMonth} delivered / ${stats.sentCount} sent). <${adminUrl}|Open expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduated_delivery_rate_alert_sent",
      ratePct,
      deliveredThisMonth: stats.deliveredThisMonth,
      sentCount: stats.sentCount,
      slack,
      discord,
    })

    alerted += 1
    countries.push(countryIso2)
  }

  return { checked: graduatedStats.size, alerted, countries }
}
