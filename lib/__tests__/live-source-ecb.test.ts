import { describe, expect, it } from "vitest"

import { fxMoves, WATCHED_CURRENCIES } from "@/lib/strategic-intelligence/external/ecb-fx"
import { fetchEcbHist90d } from "@/lib/strategic-intelligence/external/ecb-fx.server"

/**
 * LIVE check of the ECB source — a real HTTPS read of the official file, not a fixture.
 *
 * Skipped unless AFFISELL_LIVE_SOURCES=1 (the unit suite never touches the network). Run by
 * .github/workflows/intelligence-live-sources.yml, which is NOT a required check: an ECB outage must not block a PR, but a
 * red run there means the cockpit would show the source as "not verified".
 */
describe.skipIf(process.env.AFFISELL_LIVE_SOURCES !== "1")("ECB euro reference rates — live read", () => {
  it("downloads, parses and compares the 90-day file with the production code path", async () => {
    const days = await fetchEcbHist90d()
    // ~ 60 working days in 90 days; a much shorter file means the format or the URL changed.
    expect(days.length).toBeGreaterThanOrEqual(40)
    const latest = days[0]! // newest first
    const ageDays = (Date.now() - new Date(`${latest.date}T16:00:00Z`).getTime()) / 86_400_000
    expect(ageDays).toBeLessThan(6) // weekends + one holiday
    // Plausibility bounds, not values: a parser reading the wrong attribute would land far outside.
    expect(latest.rates.USD).toBeGreaterThan(0.7)
    expect(latest.rates.USD).toBeLessThan(1.8)
    expect(latest.rates.CNY).toBeGreaterThan(5)
    expect(latest.rates.CNY).toBeLessThan(12)
    const moves = fxMoves(days)
    expect(moves.map((m) => m.currency).sort()).toEqual([...WATCHED_CURRENCIES].sort())
    console.log(`[live-source-ecb] ${days.length} days, latest ${latest.date}: USD ${latest.rates.USD}, CNY ${latest.rates.CNY}; ` +
      moves.map((m) => `${m.currency} ${m.euroChangeBps} bps over 30 d`).join(", "))
  }, 20_000)
})
