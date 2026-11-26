import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildFounderDigest, neutraliseMentions } from "@/lib/strategic-intelligence/scheduled"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

const sig = (id: string, priority: StrategicSignal["priority"], title: string): StrategicSignal => ({
  id, domain: "regulatory_risk", priority, kind: "fact", title, evidence: [], source: { id: "x", query: "q" },
  observedAt: "2026-11-17T09:00:00.000Z", window: null, confidence: "high", confidenceReason: "r", recommendedAction: "a", link: null,
})

describe("founder digest", () => {
  it("nothing new = no message at all", () => {
    expect(buildFounderDigest({ newSignals: [], outcomes: [], failedCollectors: [{ id: "risk.safety_gate" }], appUrl: null })).toBeNull()
  })

  it("critical first, outcomes with their verdict, unread sources named, link to the cockpit", () => {
    const text = buildFounderDigest({
      newSignals: [sig("b", "important", "Fournisseur lent"), sig("a", "critical", "Produit signalé dangereux")],
      outcomes: [{ decisionId: "d1", title: "Demande en baisse", decision: "act", verdict: "inconclusive" }],
      failedCollectors: [{ id: "supplier.fx_ecb", error: "source_injoignable" }],
      appUrl: "https://affisell.com/",
    })!
    const lines = text.split("\n")
    expect(lines.findIndex((l) => l.includes("CRITIQUE"))).toBeLessThan(lines.findIndex((l) => l.includes("Importante")))
    expect(text).toContain("Agir — Demande en baisse : non concluant")
    expect(text).toContain("supplier.fx_ecb (source_injoignable)")
    expect(text).toContain("https://affisell.com/admin/intelligence")
  })

  it("catalogue text can not ping a whole channel", () => {
    expect(neutraliseMentions("@everyone <!channel> @here")).not.toMatch(/@everyone|<!channel|@here/)
  })
})

const m = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock("@/lib/strategic-intelligence/scheduled.server", () => ({ runIntelligenceDaily: m.run }))

describe("GET /api/cron/intelligence-daily", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret")
    m.run.mockReset().mockResolvedValue({ signals: 3, measured: 1, measureFailed: 0, notify: "sent" })
  })

  it("refuses a call without the cron secret and runs nothing", async () => {
    const { GET } = await import("@/app/api/cron/intelligence-daily/route")
    expect((await GET(new Request("http://localhost/api/cron/intelligence-daily"))).status).toBe(401)
    expect(m.run).not.toHaveBeenCalled()
  })

  it("runs with the secret; a failed measurement makes the run red (500)", async () => {
    const { GET } = await import("@/app/api/cron/intelligence-daily/route")
    const req = () => new Request("http://localhost/api/cron/intelligence-daily", { headers: { authorization: "Bearer test-cron-secret" } })
    expect((await GET(req())).status).toBe(200)
    m.run.mockResolvedValue({ signals: 3, measured: 0, measureFailed: 1, notify: "nothing_new" })
    expect((await GET(req())).status).toBe(500)
  })
})
