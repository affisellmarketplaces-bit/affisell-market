import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { loadExpansionGraduatedComplaintsByCountry } from "@/lib/expansion/load-expansion-country-complaints-since"
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

/** Slack/Discord when a graduated buyer email receives a spam complaint this month. */
export async function runExpansionGraduatedComplaintAlert(
  now = new Date()
): Promise<RunExpansionGraduatedComplaintAlertResult> {
  const weekKey = alertWeekKey(now)
  const graduatedComplaints = await loadExpansionGraduatedComplaintsByCountry(now)

  if (graduatedComplaints.size === 0) {
    return { checked: 0, alerted: 0, countries: [] }
  }

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let alerted = 0
  const countries: string[] = []

  for (const [countryIso2, complaintCount] of graduatedComplaints) {
    const id = `expansion:graduated-complaint-alert:${MARKET_REGION}:${countryIso2}:${weekKey}`
    const existing = await prisma.processedWebhook.findUnique({ where: { id } })
    if (existing) continue

    const countryName = expansionCountryLabel(countryIso2, "en")
    const text = `🎓🚫 *${countryName} (${countryIso2})* graduation email complaint — *${complaintCount}* this month. Review buyer re-engagement copy. <${adminUrl}|Open expansion console>`

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
      emailKind: "checkout-graduated",
      slack,
      discord,
    })

    alerted += 1
    countries.push(countryIso2)
  }

  return { checked: graduatedComplaints.size, alerted, countries }
}
