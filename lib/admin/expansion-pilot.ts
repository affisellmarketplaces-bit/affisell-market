import {
  enableCheckoutCountryRollout,
  notifyCheckoutCountryWaitlist,
} from "@/lib/admin/checkout-country-rollout-actions"
import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { logBusiness } from "@/lib/business-log"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import { loadGraduatedCheckoutCountryIso2 } from "@/lib/checkout-country-rollout"
import { findNextPilotCountry } from "@/lib/expansion/find-next-pilot-country"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type RunExpansionPilotResult =
  | {
      ok: true
      countryIso2: string
      countryLabel: string
      waitlistCount: number
      enabled: boolean
      notify: { sent: number; failed: number } | null
    }
  | { ok: false; error: "no_waitlist_demand" | "enable_failed"; detail?: string }

export type RunExpansionPilotOptions = {
  /** Send launch emails immediately after enable (default true). */
  notify?: boolean
  /** Override country — otherwise next waitlist rank not yet enabled. */
  countryIso2?: string
  /** Waitlist rank when country not set (1 = top, 2 = second). */
  rank?: number
}

/** Enable the top ROW waitlist country and optionally notify buyers (founder one-click pilot). */
export async function runExpansionPilot(
  options: RunExpansionPilotOptions = {}
): Promise<RunExpansionPilotResult> {
  const notify = options.notify !== false

  let countryIso2 = options.countryIso2?.trim().toUpperCase()
  let waitlistCount = 0

  if (!countryIso2) {
    const top = await prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: { marketRegion: MARKET_REGION },
      _count: { _all: true },
    })

    const rollouts = await prisma.checkoutCountryRollout.findMany({
      where: { marketRegion: MARKET_REGION, enabled: true },
      select: { countryIso2: true },
    })
    const graduated = await loadGraduatedCheckoutCountryIso2(MARKET_REGION)
    const enabledSet = new Set(rollouts.map((row) => row.countryIso2.toUpperCase()))
    const baseSet = new Set([
      ...stripeCheckoutAllowedCountriesForRegion(MARKET_REGION).map((code) => code.toUpperCase()),
      ...graduated,
    ])

    const waitlistDemand = top.map((row) => ({
      countryIso2: row.countryIso2,
      waitlistCount: row._count._all,
    }))
    const rank = options.rank ?? 1
    const candidate = findNextPilotCountry(waitlistDemand, enabledSet, baseSet, rank)
    if (!candidate) {
      return { ok: false, error: "no_waitlist_demand" }
    }
    countryIso2 = candidate.countryIso2
    waitlistCount = candidate.waitlistCount
  } else {
    waitlistCount = await prisma.checkoutLaunchWaitlist.count({
      where: { marketRegion: MARKET_REGION, countryIso2 },
    })
  }

  const enableResult = await enableCheckoutCountryRollout(countryIso2)
  if (!enableResult.ok) {
    return { ok: false, error: "enable_failed", detail: enableResult.error }
  }

  let notifyResult: { sent: number; failed: number } | null = null
  if (notify) {
    const batch = await notifyCheckoutCountryWaitlist(countryIso2)
    if (batch.ok) {
      notifyResult = { sent: batch.sent, failed: batch.failed }
    }
  }

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "pilot_enabled",
    waitlistCount,
    notifySent: notifyResult?.sent ?? 0,
  })

  return {
    ok: true,
    countryIso2,
    countryLabel: expansionCountryLabel(countryIso2, "en"),
    waitlistCount,
    enabled: true,
    notify: notifyResult,
  }
}
