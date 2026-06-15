import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import {
  expansionComplaintClearCutoff,
  shouldAutoResumeGraduationAfterComplaintClear,
} from "@/lib/expansion/expansion-complaint-clear-window"
import { shouldAutoResumeGraduationOnDeliveryWhenPausedForDelivery } from "@/lib/expansion/expansion-auto-resume-notify"
import {
  loadPausedGraduationEmailDetails,
  resumeGraduationEmailCountry,
} from "@/lib/expansion/graduation-email-pause"
import { loadExpansionGraduatedComplaintsSince } from "@/lib/expansion/load-expansion-country-complaints-since"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoResumeGraduationResult = {
  checked: number
  resumed: number
  countries: string[]
}

/** Auto-resume graduation emails when complaint window clear (30d) or delivery ≥80% (delivery pause only). */
export async function runExpansionAutoResumeGraduationCron(
  now = new Date()
): Promise<RunExpansionAutoResumeGraduationResult> {
  const complaintCutoff = expansionComplaintClearCutoff(now)
  const [graduatedRollouts, pausedDetails, graduatedComplaintsSinceCutoff, graduatedStats] =
    await Promise.all([
      prisma.checkoutCountryRollout.findMany({
        where: {
          marketRegion: MARKET_REGION,
          graduatedAt: { not: null },
        },
        select: { countryIso2: true },
      }),
      loadPausedGraduationEmailDetails(),
      loadExpansionGraduatedComplaintsSince(complaintCutoff),
      loadExpansionGraduatedEmailStatsByCountry(now),
    ])

  if (pausedDetails.size === 0) {
    return { checked: 0, resumed: 0, countries: [] }
  }

  const pausedCountries = new Set(pausedDetails.keys())
  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let resumed = 0
  const countries: string[] = []

  for (const row of graduatedRollouts) {
    const countryKey = row.countryIso2.toLowerCase()
    if (!pausedCountries.has(countryKey)) continue

    const pausedReason = pausedDetails.get(countryKey)?.reason ?? null
    const graduatedComplaintsSinceCutoffCount = graduatedComplaintsSinceCutoff.get(countryKey) ?? 0
    const stats = graduatedStats.get(countryKey)
    const graduatedDeliveredThisMonth = stats?.deliveredThisMonth ?? 0
    const graduatedSentCount = stats?.sentCount ?? 0

    const resumeOnComplaintClear = shouldAutoResumeGraduationAfterComplaintClear({
      graduatedComplaintsSinceCutoff: graduatedComplaintsSinceCutoffCount,
      pausedReason,
    })
    const resumeOnDelivery = shouldAutoResumeGraduationOnDeliveryWhenPausedForDelivery({
      graduatedDeliveredThisMonth,
      graduatedSentCount,
      pausedReason,
    })

    if (!resumeOnComplaintClear && !resumeOnDelivery) continue

    const didResume = await resumeGraduationEmailCountry(row.countryIso2)
    if (!didResume) continue

    const deliveryRatePct = computeLaunchDeliveryRatePct({
      deliveredThisMonth: graduatedDeliveredThisMonth,
      notifiedCount: graduatedSentCount,
    })
    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = resumeOnComplaintClear
      ? `▶️ *${countryName} (${row.countryIso2})* graduation emails auto-resumed — no graduation complaints in 30 days. <${adminUrl}|Expansion console>`
      : `▶️ *${countryName} (${row.countryIso2})* graduation emails auto-resumed — delivery rate *${deliveryRatePct}%*. <${adminUrl}|Expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: resumeOnComplaintClear
        ? "graduation_email_auto_resumed_complaint_clear"
        : "graduation_email_auto_resumed_delivery",
      deliveryRatePct,
      graduatedDeliveredThisMonth,
      graduatedSentCount,
      graduatedComplaintsSinceCutoff: graduatedComplaintsSinceCutoffCount,
      slack,
      discord,
    })

    resumed += 1
    countries.push(row.countryIso2)
  }

  return { checked: pausedCountries.size, resumed, countries }
}
