import { describe, expect, it } from "vitest"

import { fetchPageviewsDaily } from "@/lib/strategic-intelligence/external/wikipedia-demand"

/**
 * LIVE read of the Wikimedia page-views API through the same function the evaluation script uses. Proves the CONNECTOR
 * works — it proves NOTHING about predictive value (that is `npm run evaluate:external-demand`, on real orders).
 * Skipped unless AFFISELL_LIVE_SOURCES=1; run by .github/workflows/intelligence-live-sources.yml (not a required check).
 */
describe.skipIf(process.env.AFFISELL_LIVE_SOURCES !== "1")("Wikimedia page views — live read", () => {
  it("reads 60 days of a well-known French article", async () => {
    const to = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
    const from = new Date(Date.now() - 62 * 86_400_000).toISOString().slice(0, 10)
    const days = await fetchPageviewsDaily(fetch, "fr.wikipedia", "Jouet", from, to)
    expect(days.length).toBeGreaterThanOrEqual(50)
    const total = days.reduce((s, d) => s + d.views, 0)
    expect(total).toBeGreaterThan(100)
    console.log(`[live-source-wikipedia] fr.wikipedia/Jouet ${from} → ${to}: ${days.length} days, ${total} views (user agents)`)
  }, 20_000)
})
