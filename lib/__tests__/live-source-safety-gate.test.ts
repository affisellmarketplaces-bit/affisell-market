import { describe, expect, it } from "vitest"

import { fetchLatestSafetyGateAlerts } from "@/lib/strategic-intelligence/external/safety-gate.server"

/** LIVE read of the EU Safety Gate weekly reports (opt-in, see live-source-ecb.test.ts). */
describe.skipIf(process.env.AFFISELL_LIVE_SOURCES !== "1")("EU Safety Gate — live read", () => {
  it("reads the latest weekly reports with the production code path", async () => {
    const { reports, alerts } = await fetchLatestSafetyGateAlerts()
    expect(reports.length).toBe(2)
    const ageDays = (Date.now() - new Date(`${reports[0]!.publishedOn}T12:00:00Z`).getTime()) / 86_400_000
    expect(ageDays).toBeLessThan(10) // weekly, every Friday
    expect(alerts.length).toBeGreaterThan(10)
    for (const a of alerts) expect(a.caseNumber).toMatch(/\S/)
    const withGtin = alerts.filter((a) => a.gtins.length > 0).length
    const withModel = alerts.filter((a) => a.models.length > 0).length
    console.log(`[live-source-safety-gate] ${reports.map((r) => `${r.reference} (${r.publishedOn})`).join(", ")}: ` +
      `${alerts.length} alerts, ${withGtin} with a valid GTIN, ${withModel} with a model reference`)
  }, 60_000)
})
