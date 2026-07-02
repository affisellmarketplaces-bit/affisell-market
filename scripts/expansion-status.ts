/**
 * ROW expansion snapshot — waitlist demand, active pilots, next candidate.
 * Run: npm run expansion:status
 */
import { loadAdminExpansionOverview, expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { resolveStripeCheckoutAllowedCountries } from "@/lib/checkout-country-rollout"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

async function main() {
  const [overview, checkoutCountries] = await Promise.all([
    loadAdminExpansionOverview(),
    resolveStripeCheckoutAllowedCountries(MARKET_REGION),
  ])

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : "missing"

  console.log("[expansion-status]", {
    marketRegion: overview.marketRegion,
    stripeMode,
    checkoutCountryCount: checkoutCountries.length,
    waitlistTotal: overview.totalWaitlist,
    liveCheckoutCount: overview.liveCheckoutCount,
    autoPilotEnabled: overview.autoPilotEnabled,
  })

  if (overview.nextPilot) {
    console.log("[expansion-status] nextPilot", {
      country: overview.nextPilot.countryIso2,
      label: expansionCountryLabel(overview.nextPilot.countryIso2, "en"),
      waitlistCount: overview.nextPilot.waitlistCount,
      rank: overview.nextPilot.rank,
    })
  } else {
    console.log("[expansion-status] nextPilot", { result: "none", hint: "no ROW waitlist demand" })
  }

  type ActivePilot = {
    country: string
    label: string
    pendingNotify: number
    firstOrderAt: string | null
    graduatedAt: string | null
  }

  const enabledRollouts = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion: MARKET_REGION, enabled: true },
    orderBy: { openedAt: "desc" },
    select: {
      countryIso2: true,
      firstOrderAt: true,
      graduatedAt: true,
    },
  })

  const pendingByCountry = new Map(
    overview.countries.map((row) => [row.countryIso2.toUpperCase(), row.pendingNotifyCount])
  )

  const activePilots: ActivePilot[] = enabledRollouts.map((row) => ({
    country: row.countryIso2,
    label: expansionCountryLabel(row.countryIso2, "en"),
    pendingNotify: pendingByCountry.get(row.countryIso2.toUpperCase()) ?? 0,
    firstOrderAt: row.firstOrderAt?.toISOString() ?? null,
    graduatedAt: row.graduatedAt?.toISOString() ?? null,
  }))

  if (activePilots.length > 0) {
    console.log("[expansion-status] activeRollouts", activePilots)
  } else {
    console.log("[expansion-status] activeRollouts", { count: 0 })
  }

  const topWaitlist = overview.countries
    .filter((row) => !row.enabled && row.waitlistCount > 0)
    .slice(0, 5)
    .map((row) => ({
      country: row.countryIso2,
      label: expansionCountryLabel(row.countryIso2, "en"),
      waitlist: row.waitlistCount,
      pendingNotify: row.pendingNotifyCount,
    }))

  if (topWaitlist.length > 0) {
    console.log("[expansion-status] topWaitlistNotEnabled", topWaitlist)
  }

  console.log("[expansion-status] funnel", overview.funnel)
}

main().catch((error: unknown) => {
  console.error("[expansion-status]", {
    result: "error",
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
