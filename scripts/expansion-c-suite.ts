/**
 * Expansion C-suite — graduation playbook for active ROW pilots.
 * Run: npm run expansion:c-suite
 */
import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { isExpansionAutoPilotEnabled } from "@/lib/cron/expansion-auto-pilot"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

type PilotPlaybookRow = {
  country: string
  label: string
  openedAt: string
  phase: "awaiting_first_order" | "graduated" | "enabled_no_open_date"
  firstOrderAt: string | null
  firstOrderId: string | null
  graduatedAt: string | null
  nextAction: string
}

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : "missing"

  const rollouts = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion: MARKET_REGION, enabled: true },
    orderBy: { openedAt: "asc" },
    select: {
      countryIso2: true,
      openedAt: true,
      firstOrderAt: true,
      firstOrderId: true,
      graduatedAt: true,
      launchEmailSentAt: true,
    },
  })

  const waitlistTop = await prisma.checkoutLaunchWaitlist.groupBy({
    by: ["countryIso2"],
    where: { marketRegion: MARKET_REGION },
    _count: { _all: true },
    orderBy: { _count: { countryIso2: "desc" } },
    take: 3,
  })

  const playbook: PilotPlaybookRow[] = rollouts.map((row) => {
    const label = expansionCountryLabel(row.countryIso2, "en")
    if (row.graduatedAt) {
      return {
        country: row.countryIso2,
        label,
        openedAt: row.openedAt.toISOString(),
        phase: "graduated",
        firstOrderAt: row.firstOrderAt?.toISOString() ?? null,
        firstOrderId: row.firstOrderId,
        graduatedAt: row.graduatedAt.toISOString(),
        nextAction: "Done — country is permanent in checkout base. Monitor /admin/expansion.",
      }
    }
    if (!row.firstOrderAt) {
      return {
        country: row.countryIso2,
        label,
        openedAt: row.openedAt.toISOString(),
        phase: "awaiting_first_order",
        firstOrderAt: null,
        firstOrderId: null,
        graduatedAt: null,
        nextAction:
          stripeMode === "test"
            ? `Test checkout with shipping address ${row.countryIso2} (Stripe test card 4242…). Cron expansion-ops auto-graduates on first paid order.`
            : `First paid order with shipping ${row.countryIso2} → cron auto-graduates within 30 min.`,
      }
    }
    return {
      country: row.countryIso2,
      label,
      openedAt: row.openedAt.toISOString(),
      phase: "awaiting_first_order",
      firstOrderAt: row.firstOrderAt.toISOString(),
      firstOrderId: row.firstOrderId,
      graduatedAt: null,
      nextAction: "First order recorded — graduation should run on next expansion-ops cron. Check /admin/expansion.",
    }
  })

  console.log("[expansion-c-suite]", {
    marketRegion: MARKET_REGION,
    stripeMode,
    autoPilotEnabled: isExpansionAutoPilotEnabled(),
    activePilots: rollouts.length,
    awaitingFirstOrder: playbook.filter((row) => row.phase === "awaiting_first_order" && !row.firstOrderAt)
      .length,
    graduated: playbook.filter((row) => row.graduatedAt).length,
  })

  if (playbook.length === 0) {
    console.log("[expansion-c-suite] playbook", {
      result: "no_active_pilots",
      hint: "npm run expansion:pilot -- --no-notify --country=XX",
    })
  } else {
    console.log("[expansion-c-suite] playbook", playbook)
  }

  if (waitlistTop.length > 0) {
    console.log(
      "[expansion-c-suite] waitlistDemand",
      waitlistTop.map((row) => ({
        country: row.countryIso2,
        label: expansionCountryLabel(row.countryIso2, "en"),
        count: row._count._all,
      }))
    )
  }

  console.log("\n[expansion-c-suite] founder runbook")
  console.log("  • Monitor: /admin/expansion")
  console.log("  • Cron: GET /api/cron/expansion-ops (GitHub Actions every 30 min)")
  console.log("  • After 1st paid order: auto-graduation + optional buyer email")
  if (!isExpansionAutoPilotEnabled()) {
    console.log("  • Chain pilots: set EXPANSION_AUTO_PILOT_ON_FIRST_ORDER=1 on Vercel")
  } else {
    console.log("  • Auto-pilot ON — next waitlist country enables after first order")
  }
  if (waitlistTop.length > 0) {
    console.log(`  • Next notify: npm run expansion:pilot -- --country=${waitlistTop[0]!.countryIso2}`)
  }
}

main().catch((error: unknown) => {
  console.error("[expansion-c-suite]", {
    result: "error",
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
