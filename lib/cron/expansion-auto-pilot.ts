import { runExpansionPilot } from "@/lib/admin/expansion-pilot"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type RunExpansionAutoPilotResult = {
  attempted: boolean
  piloted: boolean
  triggerCountry?: string
  pilotCountry?: string
  skipped?: string
}

export function isExpansionAutoPilotEnabled(): boolean {
  return process.env.EXPANSION_AUTO_PILOT_ON_FIRST_ORDER === "1"
}

/**
 * After a rollout records its first order, optionally open the next waitlist country (idempotent).
 * Set `EXPANSION_AUTO_PILOT_ON_FIRST_ORDER=1` on Vercel to enable.
 */
export async function runExpansionAutoPilotAfterFirstOrders(
  triggeredByCountries: readonly string[]
): Promise<RunExpansionAutoPilotResult> {
  if (!isExpansionAutoPilotEnabled()) {
    return { attempted: false, piloted: false, skipped: "auto_pilot_disabled" }
  }

  const triggerCountry = triggeredByCountries.at(-1)?.toUpperCase()
  if (!triggerCountry) {
    return { attempted: false, piloted: false, skipped: "no_trigger_country" }
  }

  const id = `expansion:auto-pilot:after-first-order:${MARKET_REGION}:${triggerCountry}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) {
    return {
      attempted: true,
      piloted: false,
      triggerCountry,
      skipped: "already_piloted_for_trigger",
    }
  }

  const result = await runExpansionPilot({ notify: true, rank: 1 })
  if (!result.ok) {
    logBusiness("expansion-rollout", {
      marketRegion: MARKET_REGION,
      result: "auto_pilot_skipped",
      triggerCountry,
      reason: result.error,
      detail: result.detail ?? null,
    })
    return {
      attempted: true,
      piloted: false,
      triggerCountry,
      skipped: result.error,
    }
  }

  await prisma.processedWebhook.create({
    data: { id, status: "success" },
  })

  logBusiness("expansion-rollout", {
    marketRegion: MARKET_REGION,
    result: "auto_pilot",
    triggerCountry,
    pilotCountry: result.countryIso2,
    waitlistCount: result.waitlistCount,
    notifySent: result.notify?.sent ?? 0,
  })

  return {
    attempted: true,
    piloted: true,
    triggerCountry,
    pilotCountry: result.countryIso2,
  }
}
