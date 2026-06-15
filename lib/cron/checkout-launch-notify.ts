import { notifyCheckoutCountryWaitlist } from "@/lib/admin/checkout-country-rollout-actions"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type RunCheckoutLaunchNotifyCronResult = {
  countriesProcessed: number
  totalSent: number
  totalFailed: number
  errors: string[]
}

/** Drain launch-email batches for every enabled rollout with pending waitlist rows. */
export async function runCheckoutLaunchNotifyCron(): Promise<RunCheckoutLaunchNotifyCronResult> {
  const rollouts = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion: MARKET_REGION, enabled: true },
    select: { countryIso2: true },
  })

  let countriesProcessed = 0
  let totalSent = 0
  let totalFailed = 0
  const errors: string[] = []

  for (const rollout of rollouts) {
    const pending = await prisma.checkoutLaunchWaitlist.count({
      where: {
        countryIso2: rollout.countryIso2,
        marketRegion: MARKET_REGION,
        launchNotifiedAt: null,
        launchEmailSuppressedAt: null,
      },
    })
    if (pending === 0) continue

    const result = await notifyCheckoutCountryWaitlist(rollout.countryIso2)
    if (!result.ok) {
      errors.push(`${rollout.countryIso2}:${result.error}`)
      continue
    }

    countriesProcessed += 1
    totalSent += result.sent
    totalFailed += result.failed
    logBusiness("expansion-rollout", {
      country: rollout.countryIso2,
      marketRegion: MARKET_REGION,
      result: "notify_cron_batch",
      sent: result.sent,
      failed: result.failed,
    })
  }

  return { countriesProcessed, totalSent, totalFailed, errors }
}
