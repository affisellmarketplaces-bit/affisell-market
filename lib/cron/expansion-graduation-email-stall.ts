import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { findGraduationEmailStalls } from "@/lib/expansion/graduation-email-stall"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type RunGraduationEmailStallAlertResult = {
  stalledCount: number
  stalledCountries: string[]
  logged: boolean
}

/** Log when graduated countries have no buyer email 48h+ after graduation. */
export async function runGraduationEmailStallAlert(
  now = new Date()
): Promise<RunGraduationEmailStallAlertResult> {
  const pending = await prisma.checkoutCountryRollout.findMany({
    where: {
      marketRegion: MARKET_REGION,
      graduatedAt: { not: null },
      graduationEmailSentAt: null,
    },
    select: { countryIso2: true, graduatedAt: true },
  })

  const stalls = findGraduationEmailStalls(
    pending.map((row) => ({
      countryIso2: row.countryIso2,
      graduatedAt: row.graduatedAt!,
    })),
    now.getTime()
  )

  if (stalls.length === 0) {
    return { stalledCount: 0, stalledCountries: [], logged: false }
  }

  const stalledCountries = stalls.map((row) => row.countryIso2)
  logBusiness("expansion-rollout", {
    marketRegion: MARKET_REGION,
    result: "graduation_emails_stalled",
    stalledCount: stalls.length,
    countries: stalledCountries,
    countryLabels: stalledCountries.map((code) => expansionCountryLabel(code, "en")),
  })

  return { stalledCount: stalls.length, stalledCountries, logged: true }
}
