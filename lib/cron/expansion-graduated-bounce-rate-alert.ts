import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import {
  computeGraduatedBounceRatePct,
  shouldAlertGraduatedBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionGraduatedBounceRateAlertResult = {
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

/** Slack/Discord when graduation email bounce rate exceeds 5% (min 10 sent). */
export async function runExpansionGraduatedBounceRateAlert(
  now = new Date()
): Promise<RunExpansionGraduatedBounceRateAlertResult> {
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
      bouncesThisMonth: stats.bouncesThisMonth,
      sentCount: stats.sentCount,
    }

    if (!shouldAlertGraduatedBounceRate(input)) continue

    const id = `expansion:graduated-bounce-rate-alert:${MARKET_REGION}:${countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeGraduatedBounceRatePct(input)
    const countryName = expansionCountryLabel(countryIso2, "en")
    const text = `🎓📉 *${countryName} (${countryIso2})* graduation email bounce rate *${ratePct}%* (${stats.bouncesThisMonth} bounce(s) / ${stats.sentCount} sent). <${adminUrl}|Open expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduated_bounce_rate_alert_sent",
      ratePct,
      bouncesThisMonth: stats.bouncesThisMonth,
      sentCount: stats.sentCount,
      slack,
      discord,
    })

    alerted += 1
    countries.push(countryIso2)
  }

  return { checked: graduatedStats.size, alerted, countries }
}
