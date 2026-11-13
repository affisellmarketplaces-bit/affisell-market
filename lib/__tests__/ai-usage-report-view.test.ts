import { describe, expect, it } from "vitest"

import {
  buildUsagePageModel,
  formatMs,
  formatRate,
  formatUsd,
  NO_MEASURE,
  UNKNOWN,
} from "@/lib/ai/usage-report-view"
import { buildUsageReport, type AiUsageRecord } from "@/lib/ai/usage-stats"

function rec(o: Partial<AiUsageRecord> = {}): AiUsageRecord {
  return {
    v: 1,
    at: "2026-11-13T10:00:00.000Z",
    kind: "model_call",
    feature: "instantscan",
    tier: "vision_full",
    provider: "openai",
    modelRequested: "gpt-4o",
    modelUsed: "gpt-4o",
    fallbackUsed: false,
    promptTokens: 1000,
    completionTokens: 200,
    totalTokens: 1200,
    costUsdEstimated: 0.0045,
    pricingVersion: "2026-11-13",
    latencyMs: 1500,
    ok: true,
    error: null,
    ...o,
  }
}

describe("admin page view-model — measured values or an explicit absence", () => {
  it("empty journal: 'aucune mesure', no number anywhere", () => {
    const model = buildUsagePageModel(buildUsageReport([]), { backend: "memory", degraded: false })
    expect(model.empty).toBe(true)
    expect(model.emptyMessage).toContain("Aucune mesure")
    expect(model.period).toBe(NO_MEASURE)
    expect(model.tiers).toEqual([])
    expect(model.pipelines).toEqual([])
    // the old promises must not come back as figures
    const all = JSON.stringify(model)
    expect(all).not.toMatch(/98[.,]5/)
    expect(all).not.toContain("0.003")
    expect(all).not.toMatch(/\bCLIP\b/)
  })

  it("says where the numbers come from (shared journal vs this instance's memory)", () => {
    const empty = buildUsageReport([])
    expect(buildUsagePageModel(empty, { backend: "redis", degraded: false }).backendLabel).toContain("Redis, 30 jours")
    expect(buildUsagePageModel(empty, { backend: "memory", degraded: false }).backendLabel).toContain("non configuré")
    expect(buildUsagePageModel(empty, { backend: "memory", degraded: true }).backendLabel).toContain("injoignable")
  })

  it("renders measured latency, tokens, estimated cost and the model that really answered", () => {
    const report = buildUsageReport([
      rec({ latencyMs: 1000 }),
      rec({ latencyMs: 2000, modelUsed: "gpt-4o-mini", fallbackUsed: true, costUsdEstimated: 0.0003 }),
    ])
    const model = buildUsagePageModel(report, { backend: "redis", degraded: false })
    expect(model.empty).toBe(false)
    const row = model.tiers[0]!
    expect(row.label).toBe("Modèle de vision complet")
    expect(row.calls).toBe(2)
    expect(row.latencyP50).toBe("1.00 s")
    expect(row.latencyP95).toBe("2.00 s")
    expect(row.tokens).toContain("2000 entrée + 400 sortie")
    expect(row.models).toContain("gpt-4o-mini ×1")
    expect(row.models).toContain("gpt-4o ×1")
    expect(row.fallbacks).toContain("1 appel(s)")
    expect(row.cost).toContain("2/2 appels")
  })

  it("a tier whose models have no known price shows 'inconnu', never 0 $", () => {
    const report = buildUsageReport([
      rec({ tier: "category_match", provider: "groq", modelRequested: "qwen/qwen3.8-27b", modelUsed: "qwen/qwen3.8-27b", costUsdEstimated: null }),
    ])
    const row = buildUsagePageModel(report, { backend: "memory", degraded: false }).tiers[0]!
    expect(row.cost).toContain(UNKNOWN)
    expect(row.avgCostPerCall).toBe(UNKNOWN)
    expect(row.cost).not.toContain("0 $")
  })

  it("a provider that returned no token counts is stated, not shown as 0 tokens", () => {
    const report = buildUsageReport([rec({ promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null })])
    const row = buildUsagePageModel(report, { backend: "memory", degraded: false }).tiers[0]!
    expect(row.tokens).toContain("aucun compteur")
  })

  it("whole analyses are listed by the stage that answered, with the honest stage names", () => {
    const report = buildUsageReport([
      rec({ kind: "pipeline", tier: "catalog_match", latencyMs: 700, promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null }),
      rec({ kind: "pipeline", tier: "mini", latencyMs: 2500, promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null }),
      rec({ kind: "pipeline", tier: "error", ok: false, error: "ai_unavailable", latencyMs: 300, promptTokens: null, completionTokens: null, totalTokens: null, costUsdEstimated: null }),
    ])
    const labels = buildUsagePageModel(report, { backend: "redis", degraded: false }).pipelines.map((p) => p.label)
    expect(labels).toContain("Rapprochement catalogue (texte — pas de CLIP)")
    expect(labels).toContain("Modèle de vision mini (repli)")
    expect(labels).toContain("Échec (aucune analyse produite)")
    expect(labels.join(" ")).not.toMatch(/embed/i)
  })

  it("formatters never turn a missing measurement into a number", () => {
    expect(formatMs(null)).toBe(NO_MEASURE)
    expect(formatMs(850)).toBe("850 ms")
    expect(formatMs(1234)).toBe("1.23 s")
    expect(formatUsd(null)).toBe(UNKNOWN)
    expect(formatUsd(0.0045)).toBe("0.004500 $")
    expect(formatRate(null)).toBe(NO_MEASURE)
    expect(formatRate(0.25)).toBe("25.0 %")
  })
})
