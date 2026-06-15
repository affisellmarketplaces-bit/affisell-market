import { invalidateCheckoutRolloutCache } from "@/lib/checkout-country-rollout"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export type GraduateCheckoutCountryResult =
  | { ok: true; countryIso2: string; alreadyGraduated: boolean }
  | { ok: false; error: "invalid_country" | "rollout_not_found" | "no_first_order" }

/** Mark a validated rollout as permanent base checkout (idempotent). */
export async function graduateCheckoutCountryRollout(
  countryRaw: string,
  now = new Date()
): Promise<GraduateCheckoutCountryResult> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) return { ok: false, error: "invalid_country" }

  const rollout = await prisma.checkoutCountryRollout.findUnique({
    where: {
      countryIso2_marketRegion: { countryIso2, marketRegion: MARKET_REGION },
    },
  })

  if (!rollout?.enabled) {
    return { ok: false, error: "rollout_not_found" }
  }

  if (!rollout.firstOrderAt) {
    return { ok: false, error: "no_first_order" }
  }

  if (rollout.graduatedAt) {
    return { ok: true, countryIso2, alreadyGraduated: true }
  }

  await prisma.checkoutCountryRollout.update({
    where: { id: rollout.id },
    data: { graduatedAt: now },
  })

  invalidateCheckoutRolloutCache()
  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "graduated",
    firstOrderId: rollout.firstOrderId,
  })

  return { ok: true, countryIso2, alreadyGraduated: false }
}
