import { describe, expect, it } from "vitest"

import {
  familyTrackRecords,
  metricForSignal,
  signalFamily,
  summarizeLearning,
  twoProportionZ,
  validateDecisionInput,
  verdictFor,
} from "@/lib/strategic-intelligence/journal"

describe("decision journal — what can be measured, and how a result is judged", () => {
  it("maps only signals Affisell can measure itself to a metric", () => {
    expect(metricForSignal("market:category:fall:cat_1")).toEqual({ metric: "paid_orders", scope: "category:cat_1", direction: "up", defaultDays: 30 })
    expect(metricForSignal("market:marketplace:fall:2026-11-17")).toMatchObject({ metric: "paid_orders", scope: "all" })
    expect(metricForSignal("discovery:under-distributed:p_9")).toMatchObject({ scope: "product:p_9", direction: "up" })
    expect(metricForSignal("risk:dispute-activity:2026-11-17")).toMatchObject({ metric: "dispute_activity_bps", direction: "down" })
    expect(metricForSignal("risk:safety-gate:coverage:2026-11-13")).toMatchObject({ metric: "valid_gtin_share_bps", direction: "up" })
    // A fact about a supplier, an FX hypothesis, a Safety Gate match: recorded, never "measured" by a guess.
    expect(metricForSignal("supplier:fx:USD:weaker:2026-11-16")).toBeNull()
    expect(metricForSignal("risk:safety-gate:SR/03208/26:p1")).toBeNull()
  })

  it("counts: improved / worsened only beyond 2σ; otherwise inconclusive — never 'no effect'", () => {
    expect(verdictFor("paid_orders", "up", { value: 20, count: 20, base: null }, { value: 40, count: 40, base: null })).toMatchObject({ verdict: "improved" })
    expect(verdictFor("paid_orders", "up", { value: 40, count: 40, base: null }, { value: 20, count: 20, base: null })).toMatchObject({ verdict: "worsened" })
    expect(verdictFor("paid_orders", "up", { value: 20, count: 20, base: null }, { value: 25, count: 25, base: null })).toMatchObject({ verdict: "inconclusive" })
    const tiny = verdictFor("paid_orders", "up", { value: 2, count: 2, base: null }, { value: 7, count: 7, base: null })
    expect(tiny).toMatchObject({ verdict: "inconclusive", z: null })
    expect(tiny.reason).toMatch(/trop peu/)
  })

  it("proportions: a DOWN goal (disputes) is improved when the rate falls significantly", () => {
    expect(twoProportionZ(10, 1000, 10, 1000)).toBe(0)
    expect(verdictFor("dispute_activity_bps", "down", { value: 200, count: 20, base: 1000 }, { value: 50, count: 5, base: 1000 })).toMatchObject({ verdict: "improved" })
    expect(verdictFor("dispute_activity_bps", "down", { value: 200, count: 2, base: 100 }, { value: 0, count: 0, base: 30 })).toMatchObject({ verdict: "inconclusive", z: null })
  })

  it("validates what the browser sends (it only NAMES the signal)", () => {
    expect(validateDecisionInput({ signalId: "x", decision: "act", rationale: "ok, on agit" })).toMatchObject({ ok: true })
    expect(validateDecisionInput({ signalId: "x", decision: "buy", rationale: "ok, on agit" })).toEqual({ ok: false, error: "invalid_decision" })
    expect(validateDecisionInput({ signalId: "x", decision: "act", rationale: "" })).toEqual({ ok: false, error: "invalid_rationale" })
    expect(validateDecisionInput({ signalId: "x", decision: "act", rationale: "abc", measureAfterDays: 3 })).toEqual({ ok: false, error: "invalid_days" })
    expect(validateDecisionInput({ signalId: "", decision: "act", rationale: "abc" })).toEqual({ ok: false, error: "invalid_signal" })
    expect(validateDecisionInput(null)).toEqual({ ok: false, error: "invalid_body" })
  })

  it("learning groups MEASURED results by acted / not acted and domain", () => {
    expect(
      summarizeLearning([
        { decision: "act", domain: "market_observatory", verdict: "improved" },
        { decision: "experiment", domain: "market_observatory", verdict: "inconclusive" },
        { decision: "watch", domain: "market_observatory", verdict: "worsened" },
      ])
    ).toEqual([
      { decisions: "acted", domain: "market_observatory", measured: 2, improved: 1, worsened: 0, inconclusive: 1 },
      { decisions: "not_acted", domain: "market_observatory", measured: 1, improved: 0, worsened: 1, inconclusive: 0 },
    ])
  })

  it("each signal kind carries the track record of past MEASURED decisions on the same kind", () => {
    expect(signalFamily("market:category:fall:c1")).toBe("market:category")
    expect(signalFamily("risk:dispute-activity:2026-11-17")).toBe("risk:dispute-activity")
    expect(
      familyTrackRecords([
        { signalId: "market:category:fall:c1", decision: "act", verdict: "improved" },
        { signalId: "market:category:rise:c2", decision: "experiment", verdict: "inconclusive" },
        { signalId: "market:category:fall:c3", decision: "watch", verdict: "improved" },
        { signalId: "risk:dispute-activity:x", decision: "act", verdict: "worsened" },
      ])
    ).toEqual({
      "market:category": { measured: 3, actedImproved: 1, actedMeasured: 2, notActedImproved: 1, notActedMeasured: 1 },
      "risk:dispute-activity": { measured: 1, actedImproved: 0, actedMeasured: 1, notActedImproved: 0, notActedMeasured: 0 },
    })
  })
})
