import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { computeLaunchDeliveryRatePct } from "@/lib/expansion/compute-country-delivery-rate"
import { shouldAutoPauseLaunchNotifyOnComplaint } from "@/lib/expansion/compute-country-complaint-rate"
import { shouldAutoPauseGraduationOnDelivery } from "@/lib/expansion/expansion-auto-pause-notify"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import {
  loadPausedGraduationEmailCountries,
  pauseGraduationEmailCountry,
} from "@/lib/expansion/graduation-email-pause"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoPauseGraduationResult = {
  checked: number
  paused: number
  countries: string[]
}

/** Auto-pause graduation buyer emails on complaint or delivery rate <50% (min 10 sent). */
export async function runExpansionAutoPauseGraduationCron(
  now = new Date()
): Promise<RunExpansionAutoPauseGraduationResult> {
  const [graduatedRollouts, graduatedStats, alreadyPaused] = await Promise.all([
    prisma.checkoutCountryRollout.findMany({
      where: {
        marketRegion: MARKET_REGION,
        graduatedAt: { not: null },
      },
      select: { countryIso2: true },
    }),
    loadExpansionGraduatedEmailStatsByCountry(now),
    loadPausedGraduationEmailCountries(),
  ])

  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  let paused = 0
  const countries: string[] = []

  for (const row of graduatedRollouts) {
    const countryKey = row.countryIso2.toLowerCase()
    if (alreadyPaused.has(countryKey)) continue

    const stats = graduatedStats.get(countryKey)
    const complaintsThisMonth = stats?.complaintsThisMonth ?? 0
    const deliveredThisMonth = stats?.deliveredThisMonth ?? 0
    const sentCount = stats?.sentCount ?? 0

    const pauseOnComplaint = shouldAutoPauseLaunchNotifyOnComplaint({
      complaintsThisMonth,
      notifiedCount: sentCount,
    })
    const pauseOnDelivery = shouldAutoPauseGraduationOnDelivery({
      graduatedDeliveredThisMonth: deliveredThisMonth,
      graduatedSentCount: sentCount,
    })

    if (!pauseOnComplaint && !pauseOnDelivery) continue

    const deliveryRatePct = computeLaunchDeliveryRatePct({
      deliveredThisMonth,
      notifiedCount: sentCount,
    })
    const reason = pauseOnComplaint
      ? `graduated_complaint_${complaintsThisMonth}`
      : `graduated_delivery_rate_${deliveryRatePct}pct`

    const didPause = await pauseGraduationEmailCountry(row.countryIso2, reason)
    if (!didPause) continue

    const countryName = expansionCountryLabel(row.countryIso2, "en")
    const text = pauseOnComplaint
      ? `⏸️ *${countryName} (${row.countryIso2})* graduation emails auto-paused — *${complaintsThisMonth} graduation complaint(s)*. <${adminUrl}|Resume in expansion console>`
      : `⏸️ *${countryName} (${row.countryIso2})* graduation emails auto-paused — delivery rate *${deliveryRatePct}%*. <${adminUrl}|Resume in expansion console>`

    const { slack, discord } = await opsWebhookAlert(text)

    logBusiness("expansion-rollout", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: pauseOnComplaint
        ? "graduation_email_auto_paused_complaint"
        : "graduation_email_auto_paused_delivery",
      complaintsThisMonth,
      deliveryRatePct,
      deliveredThisMonth,
      sentCount,
      slack,
      discord,
    })

    paused += 1
    countries.push(row.countryIso2)
  }

  return { checked: graduatedRollouts.length, paused, countries }
}
