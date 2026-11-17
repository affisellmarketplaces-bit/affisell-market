import { describe, expect, it } from "vitest"

import {
  categoryDemandSignals,
  countDistinctDisputes,
  disputeActivitySignal,
  evolutionRecommendations,
  normalQuantile,
  poissonDropIsReliable,
  poissonRiseIsReliable,
  profitAlertPatternSignals,
  sentinelSignal,
  singleResellerDemandSignals,
  slowSupplierSignals,
  supplierPriceIncreaseSignals,
  twoPeriodZ,
  unallocatedLinesSignal,
  zThresholdForTests,
} from "@/lib/strategic-intelligence/detectors"
import { domainCoverage, listIntelligenceSources } from "@/lib/strategic-intelligence/sources"
import { INTELLIGENCE_DOMAINS, rankSignals } from "@/lib/strategic-intelligence/types"

const ctx = { observedAt: "2026-11-17T08:00:00.000Z", window: { from: "2026-10-18T08:00:00.000Z", to: "2026-11-17T08:00:00.000Z" } }

describe("sources — never claims to watch what is not connected", () => {
  it("internal sources are connected; external ones only 'configured' when credentials exist, never connected", () => {
    const none = listIntelligenceSources({})
    expect(none.filter((s) => s.kind === "internal").every((s) => s.status === "connected")).toBe(true)
    expect(none.filter((s) => s.kind !== "internal").every((s) => s.status === "not_connected")).toBe(true)
    const withKey = listIntelligenceSources({ SERPER_API_KEY: "x" })
    expect(withKey.find((s) => s.id === "serper.google_search")!.status).toBe("configured")
    expect(withKey.some((s) => s.kind !== "internal" && s.status === "connected")).toBe(false)
  })

  it("the fixture 'market intelligence' is never treated as a source, whatever the environment", () => {
    const s = listIntelligenceSources({ MARKET_INTELLI_ENABLED: "1" }).find((x) => x.id === "market_intelligence.fixtures")!
    expect(s.status).toBe("not_connected")
  })

  it("coverage shows the blind spots (competitive, innovation) honestly", () => {
    const cov = domainCoverage(listIntelligenceSources({}))
    expect(cov.innovation).toBe("not_connected")
    expect(cov.competitive).toBe("not_connected")
    expect(cov.commercial).toBe("connected")
    expect(Object.keys(cov).every((d) => (INTELLIGENCE_DOMAINS as readonly string[]).includes(d))).toBe(true)
  })

  it("never exposes a credential value", () => {
    const json = JSON.stringify(listIntelligenceSources({ SERPER_API_KEY: "sk-secret-123", AMAZON_LWA_CLIENT_ID: "amzn-secret" }))
    expect(json).not.toContain("secret")
  })
})

describe("detectors — changes only beyond randomness, every signal sourced and typed", () => {
  it("Poisson reliability", () => {
    expect(poissonRiseIsReliable(10, 17)).toBe(true) // 10 + 2√10 ≈ 16.3
    expect(poissonRiseIsReliable(10, 16)).toBe(false)
    expect(poissonRiseIsReliable(3, 9)).toBe(false) // too small to judge
    expect(poissonDropIsReliable(25, 15)).toBe(true)
    expect(poissonDropIsReliable(9, 0)).toBe(false)
  })

  it("category demand: rise = study, fall = important, noise = nothing", () => {
    const out = categoryDemandSignals(
      [
        { categoryId: "a", name: "Lampes", current: 30, previous: 15 },
        { categoryId: "b", name: "Sacs", current: 10, previous: 30 },
        { categoryId: "c", name: "Bols", current: 6, previous: 3 },
      ],
      ctx
    )
    expect(out.map((s) => [s.id, s.priority, s.kind])).toEqual([
      ["market:category:rise:a", "study", "fact"],
      ["market:category:fall:b", "important", "fact"],
    ])
    for (const s of out) {
      expect(s.source.id).toBe("affisell.orders.categories")
      expect(s.confidenceReason).toMatch(/pas le marché mondial/)
    }
  })

  it("multiple testing: the threshold grows with the number of comparisons", () => {
    expect(zThresholdForTests(1)).toBe(2) // 1.96 → floor 2
    expect(zThresholdForTests(100)).toBeCloseTo(3.48, 1)
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 3)
    expect(twoPeriodZ(25, 40)).toBeCloseTo(15 / Math.sqrt(65), 6)
  })

  it("100 categories moving by ≈ 2σ each in both directions = noise, not 100 signals", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ categoryId: `c${i}`, name: `C${i}`, previous: 25, current: i % 2 ? 40 : 10 }))
    expect(categoryDemandSignals(rows, ctx)).toEqual([])
  })

  it("a marketplace-wide fall is ONE signal, not one per category", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ categoryId: `c${i}`, name: `C${i}`, previous: 40, current: 20 }))
    const out = categoryDemandSignals(rows, ctx)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ priority: "important", kind: "fact" })
    expect(out[0]!.id).toMatch(/^market:marketplace:fall:/)
    expect(out[0]!.recommendedAction).toMatch(/cause transverse/)
  })

  it("under-distributed product: proven demand, one reseller, little supply", () => {
    const out = singleResellerDemandSignals(
      [
        { productId: "p1", name: "A", orders30: 12, resellers: 1, listedResellers: 1 },
        { productId: "p2", name: "B", orders30: 12, resellers: 1, listedResellers: 5 },
        { productId: "p3", name: "C", orders30: 4, resellers: 1, listedResellers: 1 },
      ],
      ctx
    )
    expect(out.map((s) => s.id)).toEqual(["discovery:under-distributed:p1"])
    expect(out[0]!.kind).toBe("recommendation")
  })

  it("supplier: a broad price rise is important, above 15 % critical; one product is not a pattern", () => {
    const out = supplierPriceIncreaseSignals(
      [
        { supplierId: "s1", supplierName: "X", products: 4, avgIncreaseBps: 800, listingsAffected: 6 },
        { supplierId: "s2", supplierName: "Y", products: 5, avgIncreaseBps: 2000, listingsAffected: 9 },
        { supplierId: "s3", supplierName: "Z", products: 1, avgIncreaseBps: 5000, listingsAffected: 20 },
      ],
      ctx
    )
    expect(out.map((s) => [s.title.includes("X") ? "s1" : "s2", s.priority])).toEqual([
      ["s1", "important"],
      ["s2", "critical"],
    ])
  })

  it("slow supplier only when it is slow, measured and matters", () => {
    expect(
      slowSupplierSignals(
        [
          { supplierId: "a", supplierName: "A", p90Days: 15, sampleSize: 40, ordersShareBps: 1200 },
          { supplierId: "b", supplierName: "B", p90Days: 15, sampleSize: 5, ordersShareBps: 1200 },
          { supplierId: "c", supplierName: "C", p90Days: 15, sampleSize: 40, ordersShareBps: 100 },
          { supplierId: "d", supplierName: "D", p90Days: 9, sampleSize: 40, ordersShareBps: 1200 },
        ],
        ctx
      ).map((s) => s.id)
    ).toEqual(["supplier:slow:a"])
  })

  it("dispute activity against Stripe's 0.75 % reference; tiny samples ignored", () => {
    expect(disputeActivitySignal({ disputes30: 3, payments30: 300 }, ctx)[0]!).toMatchObject({ priority: "critical", confidence: "high" }) // 1 %
    // Above 0.75 % but only 2 disputes: a small-number effect → important, low confidence, never critical.
    const two = disputeActivitySignal({ disputes30: 2, payments30: 200 }, ctx)[0]!
    expect(two).toMatchObject({ priority: "important", confidence: "low" })
    expect(two.confidenceReason).toMatch(/petit volume/)
    expect(disputeActivitySignal({ disputes30: 1, payments30: 160 }, ctx)[0]!.priority).toBe("important") // 0.63 %
    expect(disputeActivitySignal({ disputes30: 1, payments30: 400 }, ctx)).toEqual([]) // 0.25 %
    expect(disputeActivitySignal({ disputes30: 3, payments30: 20 }, ctx)).toEqual([]) // too few payments
  })

  it("counts each dispute once, whatever the number of orders on the disputed charge", () => {
    expect(
      countDistinctDisputes(["dispute:dp_1:o1", "dispute:dp_1:o2", "dispute:dp_2:o3", "stripe:evt_x", "dispute:dp_2:o4"])
    ).toBe(2)
  })

  it("unpaid-back lines, sentinel incidents, profit-alert pattern", () => {
    expect(unallocatedLinesSignal({ lines: 0, refundableCents: 0, oldestAt: null }, ctx)).toEqual([])
    expect(unallocatedLinesSignal({ lines: 2, refundableCents: 4200, oldestAt: ctx.observedAt }, ctx)[0]).toMatchObject({ priority: "critical" })
    expect(sentinelSignal({ p0: 0, p1: 0 }, ctx)).toEqual([])
    expect(sentinelSignal({ p0: 1, p1: 0 }, ctx)[0]!.priority).toBe("critical")
    expect(profitAlertPatternSignals([{ cause: "volume_down", alerts: 3, resellers: 3, lostCents: 1 }], ctx)).toEqual([]) // < 5
    const p = profitAlertPatternSignals(
      [
        { cause: "supplier_price_up", alerts: 6, resellers: 5, lostCents: 50_000 },
        { cause: "volume_down", alerts: 2, resellers: 2, lostCents: 3_000 },
      ],
      ctx
    )
    expect(p[0]).toMatchObject({ priority: "important", domain: "commercial" })
    expect(p[0]!.title).toMatch(/fournisseurs/)
    expect(
      profitAlertPatternSignals(
        [
          { cause: "a", alerts: 3, resellers: 3, lostCents: 1 },
          { cause: "b", alerts: 3, resellers: 3, lostCents: 1 },
          { cause: "c", alerts: 3, resellers: 3, lostCents: 1 },
        ],
        ctx
      )
    ).toEqual([]) // no dominant cause
  })

  it("evolution recommendations come only from what the cockpit observed", () => {
    const out = evolutionRecommendations(
      {
        notConnectedDomains: [{ domain: "innovation", label: "Radar d'innovation", note: "Aucune source." }],
        missingTables: [{ collector: "commercial.profit_alert_pattern", migration: "20261117120000_reseller_profit_alerts" }],
      },
      ctx
    )
    expect(out.map((s) => [s.kind, s.priority])).toEqual([
      ["recommendation", "important"],
      ["recommendation", "study"],
    ])
  })

  it("ranking: critical first, duplicates removed, stable", () => {
    const a = sentinelSignal({ p0: 1, p1: 0 }, ctx)[0]!
    const b = sentinelSignal({ p0: 0, p1: 2 }, ctx)[0]! // important
    expect(rankSignals([b, a, a]).map((s) => s.id)).toEqual([a.id, b.id])
  })
})
