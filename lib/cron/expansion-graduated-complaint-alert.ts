import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { expansionComplaintsExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  computeCountryComplaintRatePct,
  shouldAlertCountryComplaint,
} from "@/lib/expansion/compute-country-complaint-rate"
import { loadExpansionGraduatedComplaintsByCountry } from "@/lib/expansion/load-expansion-country-complaints-since"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionGraduatedComplaintAlertResult = {
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

/** Slack/Discord when graduation email complaint rate exceeds threshold (min 10 sent). */
export async function runExpansionGraduatedComplaintAlert(
  now = new Date()
): Promise<RunExpansionGraduatedComplaintAlertResult> {
  const weekKey = alertWeekKey(now)
  const [graduatedComplaints, graduatedEmailStats] = await Promise.all([
    loadExpansionGraduatedComplaintsByCountry(now),
    loadExpansionGraduatedEmailStatsByCountry(now),
  ])

  if (graduatedComplaints.size === 0) {
    return { checked: 0, alerted: 0, countries: [] }
  }

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const [countryIso2, complaintCount] of graduatedComplaints) {
    const sentCount = graduatedEmailStats.get(countryIso2.toLowerCase())?.sentCount ?? 0
    const input = {
      complaintsThisMonth: complaintCount,
      notifiedCount: sentCount,
    }

    if (!shouldAlertCountryComplaint(input)) continue

    const id = `expansion:graduated-complaint-alert:${MARKET_REGION}:${countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const ratePct = computeCountryComplaintRatePct(input)
    const countryName = expansionCountryLabel(countryIso2, "en")
    const complaintsExportUrl = `${resolveAppUrl()}${expansionComplaintsExportPath(countryIso2, "checkout-graduated")}`
    const text = `🎓🚫 *${countryName} (${countryIso2})* graduation email complaint — *${complaintCount}* this month (${ratePct}% of sent). <${complaintsExportUrl}|Export graduation complaints CSV> · <${adminUrl}|Expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)
    if (!slack && !discord) continue

    await prisma.processedWebhook.create({
      data: { id, status: "success" },
    })

    logBusiness("expansion-rollout", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "graduated_complaint_alert_sent",
      complaintCount,
      ratePct,
      sentCount,
      emailKind: "checkout-graduated",
      slack,
      discord,
    })

    alerted += 1
    countries.push(countryIso2)
  }

  return { checked: graduatedComplaints.size, alerted, countries }
}
