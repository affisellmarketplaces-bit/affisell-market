import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export type UnsuppressLaunchWaitlistResult =
  | { ok: true; countryIso2: string; unsuppressed: number }
  | { ok: false; error: "invalid_country" }

/** Founder override — re-queue suppressed waitlist rows for one country notify batch. */
export async function unsuppressLaunchWaitlistCountry(
  countryRaw: string
): Promise<UnsuppressLaunchWaitlistResult> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) return { ok: false, error: "invalid_country" }

  const updated = await prisma.checkoutLaunchWaitlist.updateMany({
    where: {
      marketRegion: MARKET_REGION,
      countryIso2,
      launchEmailSuppressedAt: { not: null },
    },
    data: {
      launchEmailSuppressedAt: null,
      launchEmailBouncedAt: null,
      launchNotifiedAt: null,
      launchFollowUpSentAt: null,
    },
  })

  logBusiness("launch-waitlist", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "launch_email_unsuppressed",
    unsuppressed: updated.count,
  })

  return { ok: true, countryIso2, unsuppressed: updated.count }
}
