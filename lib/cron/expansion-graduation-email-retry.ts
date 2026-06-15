import { notifyCheckoutCountryGraduatedBuyers } from "@/lib/admin/notify-checkout-country-graduated-buyers"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

const RETRY_BATCH = 3

export type RunGraduationEmailRetryResult = {
  attempted: number
  completed: number
  partial: number
  countries: string[]
}

/** Retry graduation buyer emails for countries not yet marked sent (idempotent per country). */
export async function runGraduationEmailRetryCron(): Promise<RunGraduationEmailRetryResult> {
  const pending = await prisma.checkoutCountryRollout.findMany({
    where: {
      marketRegion: MARKET_REGION,
      graduatedAt: { not: null },
      graduationEmailSentAt: null,
    },
    select: { countryIso2: true },
    orderBy: { graduatedAt: "asc" },
    take: RETRY_BATCH,
  })

  if (pending.length === 0) {
    return { attempted: 0, completed: 0, partial: 0, countries: [] }
  }

  let completed = 0
  let partial = 0
  const countries: string[] = []

  for (const row of pending) {
    const result = await notifyCheckoutCountryGraduatedBuyers(row.countryIso2)
    if (result.skipped) continue

    countries.push(row.countryIso2)
    if (result.failed > 0) {
      partial += 1
    } else {
      completed += 1
    }
  }

  if (countries.length > 0) {
    logBusiness("expansion-rollout", {
      marketRegion: MARKET_REGION,
      result: "graduation_emails_retry",
      attempted: countries.length,
      completed,
      partial,
      countries,
    })
  }

  return { attempted: countries.length, completed, partial, countries }
}
