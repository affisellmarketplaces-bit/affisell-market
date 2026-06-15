import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  computeCountryComplaintRatePct,
  shouldAlertCountryComplaint,
} from "@/lib/expansion/compute-country-complaint-rate"
import { loadExpansionCountryComplaintStats } from "@/lib/expansion/load-expansion-country-complaint-stats"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionComplaintAlertResult = {
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

/** Slack/Discord when a country has expansion email complaint(s) this month (min 10 notified). */
export async function runExpansionComplaintAlert(
  now = new Date()
): Promise<RunExpansionComplaintAlertResult> {
  const weekKey = alertWeekKey(now)
  const [notifiedGroups, complaintStats] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion: MARKET_REGION,
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    loadExpansionCountryComplaintStats(now),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const row of notifiedGroups) {
    const complaintsThisMonth = complaintStats.get(row.countryIso2)?.complaintsThisMonth ?? 0
    const input = {
      complaintsThisMonth,
      notifiedCount: row._count._all,
    }

    if (!shouldAlertCountryComplaint(input)) continue

    const id = `expansion:complaint-alert:${MARKET_REGION}:${row.countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeCountryComplaintRatePct(input)
    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const complaintsExportUrl = `${resolveAppUrl()}${expansionComplaintsExportPath(row.countryIso2, "checkout-launch")}`
    const text = `🚫 *${countryName} (${row.countryIso2})* launch email complaint — *${complaintsThisMonth}* this month (${ratePct}% of notified). <${complaintsExportUrl}|Export launch complaints CSV> · <${adminUrl}|Expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "complaint_alert_sent",
      complaintsThisMonth,
      ratePct,
      notifiedCount: row._count._all,
      emailKind: "checkout-launch",
      slack,
      discord,
    })

    alerted += 1
    countries.push(row.countryIso2)
  }

  return { checked: notifiedGroups.length, alerted, countries }
}
