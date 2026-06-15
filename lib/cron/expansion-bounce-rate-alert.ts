import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { loadExpansionCountryBounceStats } from "@/lib/expansion/load-expansion-country-bounce-stats"
import {
  computeCountryBounceRatePct,
  shouldAlertCountryBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionBounceRateAlertResult = {
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

/** Slack/Discord when a country's launch-email bounce rate exceeds 5% (min 10 notified). */
export async function runExpansionBounceRateAlert(
  now = new Date()
): Promise<RunExpansionBounceRateAlertResult> {
  const weekKey = alertWeekKey(now)
  const [notifiedGroups, bounceStats] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionCountryBounceStats(),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    const bounce = bounceStats.get(row.countryIso2) ?? { retriesPending: 0, suppressed: 0 }
    const input = {
      notifiedCount: row._count._all,
      retriesPending: bounce.retriesPending,
      suppressed: bounce.suppressed,
    }

    if (!shouldAlertCountryBounceRate(input)) continue

    const id = `expansion:bounce-rate-alert:${MARKET_REGION}:${row.countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeCountryBounceRatePct(input)
    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = `📉 *${countryName} (${row.countryIso2})* launch-email bounce rate *${ratePct}%* (${bounce.suppressed} suppressed · ${bounce.retriesPending} retry pending). <${adminUrl}|Open expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "bounce_rate_alert_sent",
      ratePct,
      suppressed: bounce.suppressed,
      retriesPending: bounce.retriesPending,
      notifiedCount: row._count._all,
      slack,
      discord,
    })

    alerted += 1
    countries.push(row.countryIso2)
  }

  return { checked: notifiedGroups.length, alerted, countries }
}
