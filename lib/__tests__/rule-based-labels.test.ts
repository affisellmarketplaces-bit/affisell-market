import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Owner mandate: "if a feature rests on a deterministic rule, say so clearly". These functions are presented in the product
 * as "AI" / "intelligence" / "prediction"; each one must carry the label in its API answer, its UI and its source.
 */

const ROOT = process.cwd()
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8")

describe("API answers name the method", () => {
  it("/api/ai/pricing is three fixed multipliers, not AI", async () => {
    const { POST } = await import("@/app/api/ai/pricing/route")
    const res = await POST(
      new Request("http://localhost/api/ai/pricing", { method: "POST", body: JSON.stringify({ cost: 100 }) })
    )
    const body = (await res.json()) as { method: string; suggestions: Array<{ id: string; price: number }> }
    expect(body.method).toBe("rule_based")
    expect(body.suggestions.map((s) => s.price)).toEqual([145, 162, 185])
  })

  it("/api/ai/style-advice is static templates, not generated advice", async () => {
    const { POST } = await import("@/app/api/ai/style-advice/route")
    const res = await POST(
      new Request("http://localhost/api/ai/style-advice", {
        method: "POST",
        body: JSON.stringify({ productId: "p1", productName: "Veste" }),
      })
    )
    const body = (await res.json()) as { method: string; ideas: string[] }
    expect(body.method).toBe("static_templates")
    expect(body.ideas).toHaveLength(3)
  })
})

describe("rule-based modules say so in their source", () => {
  const MODULES: Array<[string, RegExp]> = [
    ["lib/ai/margin-optimizer.ts", /NOT an AI model/],
    ["lib/ai/success-scorer.ts", /NOT an AI model and NOT a probability/],
    ["lib/profit/profit-presets.ts", /NOT AI/],
    ["lib/trust-score.ts", /NOT an AI model/],
    ["lib/radar/arbitrage-score.ts", /NOT an AI model/],
    ["lib/radar/saturation.ts", /NOT an AI model/],
    ["lib/ai/smart-margin-types.ts", /nothing behind these types is a machine-learning model/],
    ["lib/ai/market-intelligence-fixtures.ts", /not market data/],
  ]
  it.each(MODULES)("%s", (path, pattern) => {
    expect(read(path)).toMatch(pattern)
  })
})

describe("the UI that presents them does not claim AI", () => {
  it("Smart Margin panel: no 'AI' title, no 'probability', says rule-based and unmeasured", () => {
    const src = read("components/supplier/smart-margin-ai-panel.tsx")
    expect(src).not.toContain("Smart Margin AI")
    expect(src).not.toContain("Probabilité de succès")
    expect(src).toContain("pas un modèle d")
    // the "unmeasured" wording comes from the tested pure helper, for every origin including an unknown one
    expect(src).toContain("marketDataNote(analysis?.market_data?.origin)")
    expect(read("lib/ai/smart-margin-labels.ts")).toContain("non mesur")
  })

  it("Pricing optimizer shows the rule note", () => {
    expect(read("components/affiliate/ai-pricing-optimizer.tsx")).toContain('t("ruleNote")')
  })

  it("World Radar terminal and globe do not show LIVE for anything but real, fresh data", () => {
    const terminal = read("components/radar/world-radar-terminal.tsx")
    expect(terminal).toContain("radarBadgeKind(data)")
    expect(terminal).not.toMatch(/const isLive = data\?\.isLive\b/)
    expect(terminal).toContain('t("demoBadge")')
    expect(terminal).toContain('t("scoresAreRules")')
    const globe = read("components/radar/GlobePageClient.tsx")
    // the title no longer hard-codes LIVE and the red pulse only shows for source === "live"
    expect(globe).not.toMatch(/AFFISELL RADAR · LIVE/)
    expect(globe).toContain('source === "live"')
  })
})

describe("translations exist for every locale", () => {
  const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]
  const messages = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(read(`messages/${l}.json`))])) as Record<
    string,
    {
      radarGlobe: Record<string, string>
      radarTerminal: Record<string, string>
      affiliateDashboard: { listingBuilder: { aiPricing: Record<string, string> } }
    }
  >

  it.each(LOCALES)("%s has the demo / rule labels", (locale) => {
    const m = messages[locale]!
    for (const key of ["badgeLive", "badgeMixed", "badgeDemo", "demoNotice", "mixedNotice", "demoEvent", "demoEventNotice", "estimatedLocation"]) {
      expect(m.radarGlobe[key], `radarGlobe.${key}`).toBeTruthy()
    }
    for (const key of ["demoBadge", "demoBannerMock", "demoBannerMixed", "demoBannerDemo", "scoresAreRules"]) {
      expect(m.radarTerminal[key], `radarTerminal.${key}`).toBeTruthy()
    }
    expect(m.affiliateDashboard.listingBuilder.aiPricing.ruleNote).toBeTruthy()
  })

  it.each(LOCALES)("%s: the pricing suggestion is no longer labelled as AI", (locale) => {
    const label = messages[locale]!.affiliateDashboard.listingBuilder.aiPricing.aiSuggests ?? ""
    expect(label).not.toMatch(/\bIA\b|\bAI\b|\bKI\b/i)
  })
})
