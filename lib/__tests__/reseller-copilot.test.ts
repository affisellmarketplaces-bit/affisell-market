import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const queryRaw = vi.hoisted(() => vi.fn())
const findMany = vi.hoisted(() => vi.fn())
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw, affiliateProduct: { findMany } },
}))

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { loadProductRiskContext, loadResellerListingHealth } from "@/lib/reseller-copilot.server"
import { DEFAULT_EXPECTED_REFUND_RATE, evaluateMarginGuard } from "@/lib/reseller-margin-guard"
import {
  demandIndex,
  evaluateListingHealth,
  rankOpportunities,
  scoreOpportunity,
  sortListingHealth,
  supplierReliability,
} from "@/lib/reseller-opportunity-score"
import {
  CATEGORY_PRIOR_WEIGHT,
  PRODUCT_PRIOR_WEIGHT,
  categoryRefundRate,
  detectRefundTrend,
  estimateRefundRisk,
} from "@/lib/reseller-refund-risk"

describe("hierarchical refund risk", () => {
  it("no data anywhere = exactly the platform default (nothing invented)", () => {
    const r = estimateRefundRisk({})
    expect(r.rate).toBe(DEFAULT_EXPECTED_REFUND_RATE)
    expect(r.source).toBe("default")
    expect(r.confidence).toBe(0)
    expect(r.estimated).toBe(true)
  })

  it("a product without sales takes its category's MEASURED rate, not the global 10 %", () => {
    const category = { purchases: 1000, refunds: 300 }
    const r = estimateRefundRisk({ category })
    expect(r.rate).toBeCloseTo(categoryRefundRate(category), 10)
    expect(r.rate).toBeCloseTo((300 + CATEGORY_PRIOR_WEIGHT * 0.1) / (1000 + CATEGORY_PRIOR_WEIGHT), 10)
    expect(r.source).toBe("category")
  })

  it("a product's own sales move it away from its category only as fast as its evidence allows", () => {
    const category = { purchases: 1000, refunds: 100 }
    const few = estimateRefundRisk({
      product: { purchases: 4, refunds: 4 },
      category,
    })
    const many = estimateRefundRisk({
      product: { purchases: 400, refunds: 200 },
      category,
    })
    expect(few.rate).toBeLessThan(0.3) // 4 refunds out of 4 is not "100 %"
    expect(many.rate).toBeGreaterThan(0.45)
    expect(many.source).toBe("product")
    expect(many.confidence).toBeCloseTo(400 / (400 + PRODUCT_PRIOR_WEIGHT), 10)
  })

  it("the prudent rate is above the mean and shrinks with evidence", () => {
    const thin = estimateRefundRisk({ product: { purchases: 2, refunds: 0 } })
    const thick = estimateRefundRisk({
      product: { purchases: 2000, refunds: 200 },
    })
    expect(thin.upperRate).toBeGreaterThan(thin.rate)
    expect(thick.upperRate - thick.rate).toBeLessThan(thin.upperRate - thin.rate)
  })

  it("garbage counts are cleaned: refunds never exceed purchases, negatives are 0", () => {
    const r = estimateRefundRisk({
      product: { purchases: 10, refunds: 50 },
      category: { purchases: -5, refunds: NaN },
    })
    expect(r.rate).toBeLessThanOrEqual(1)
    expect(r.rate).toBeGreaterThan(0)
  })
})

describe("refund trend", () => {
  it("says nothing below the minimum sample in either window", () => {
    expect(detectRefundTrend({ purchases: 10, refunds: 9 }, { purchases: 500, refunds: 10 })).toBeNull()
  })

  it("flags a real, material rise", () => {
    const t = detectRefundTrend({ purchases: 80, refunds: 24 }, { purchases: 400, refunds: 32 })
    expect(t?.rising).toBe(true)
  })

  it("does not flag noise or a negligible rise", () => {
    expect(detectRefundTrend({ purchases: 20, refunds: 3 }, { purchases: 200, refunds: 20 })?.rising).toBe(false)
    expect(detectRefundTrend({ purchases: 5000, refunds: 600 }, { purchases: 5000, refunds: 500 })?.rising).toBe(false)
  })
})

describe("opportunity score", () => {
  const risk = estimateRefundRisk({})
  const eco = buildAffiliateCatalogCardEconomics(5000, 20) // 50 € supplier price, 20 % commission

  it("is 0 and not recommendable when the guard refuses the product", () => {
    const poor = buildAffiliateCatalogCardEconomics(300, 0, {
      markupRate: 0.05,
    })
    const s = scoreOpportunity({
      productId: "p_poor1",
      netGainCents: poor.netPartnerGainCents,
      clientPriceCents: poor.clientPriceCents,
      refundRisk: risk,
    })
    expect(s.recommendable).toBe(false)
    expect(s.score).toBe(0)
  })

  it("uses the guard's figure at the prudent rate, never above the mean-rate figure", () => {
    const s = scoreOpportunity({
      productId: "p_good1",
      netGainCents: eco.netPartnerGainCents,
      clientPriceCents: eco.clientPriceCents,
      refundRisk: risk,
    })
    const mean = evaluateMarginGuard({
      netGainCents: eco.netPartnerGainCents,
      clientPriceCents: eco.clientPriceCents,
    })
    expect(s.riskAdjustedNetCents).toBeLessThan(mean.expectedNetCents)
    expect(s.score).toBe(s.riskAdjustedNetCents) // no demand, supplier unknown: neutral factors
    expect(s.estimated).toBe(true)
  })

  it("demand and supplier reliability reorder equal economics; risk lowers a product", () => {
    const base = {
      netGainCents: eco.netPartnerGainCents,
      clientPriceCents: eco.clientPriceCents,
    }
    const ranked = rankOpportunities([
      scoreOpportunity({ ...base, productId: "p_quiet", refundRisk: risk }),
      scoreOpportunity({
        ...base,
        productId: "p_hot01",
        refundRisk: risk,
        recentPurchases: 40,
      }),
      scoreOpportunity({
        ...base,
        productId: "p_risky",
        refundRisk: estimateRefundRisk({
          product: { purchases: 300, refunds: 150 },
        }),
        recentPurchases: 40,
      }),
      scoreOpportunity({
        ...base,
        productId: "p_badsp",
        refundRisk: risk,
        recentPurchases: 40,
        supplierRefundRate: 0.6,
      }),
    ]).map((s) => s.productId)
    expect(ranked[0]).toBe("p_hot01")
    // Same demand, same economics: the product refunded half the time ranks below the clean one.
    expect(ranked.indexOf("p_risky")).toBeGreaterThan(ranked.indexOf("p_hot01"))
    expect(ranked.indexOf("p_badsp")).toBeGreaterThan(ranked.indexOf("p_hot01"))
  })

  it("factors are bounded and neutral by default", () => {
    expect(demandIndex(0)).toBe(1)
    expect(demandIndex(null)).toBe(1)
    expect(demandIndex(-3)).toBe(1)
    expect(supplierReliability(undefined)).toBe(1)
    expect(supplierReliability(2)).toBe(0)
  })
})

describe("listing health", () => {
  const risk = estimateRefundRisk({})
  it("flags a listing whose supplier price reached the reseller's price", () => {
    const eco = buildAffiliateCatalogCardEconomics(5000, 10, {
      listedSellingPriceCents: 4900,
    })
    const h = evaluateListingHealth({
      listingId: "l1",
      productId: "p1",
      sellingPriceCents: 4900,
      supplierPriceCents: 5000,
      netGainCents: eco.netPartnerGainCents,
      refundRisk: risk,
    })
    expect(h.issues).toContain("supplier_price_at_or_above_selling")
    expect(h.status).toBe("action")
  })

  it("a healthy listing is ok; a rising refund trend needs action; thin only needs watching", () => {
    const eco = buildAffiliateCatalogCardEconomics(5000, 20, {
      listedSellingPriceCents: 7000,
    })
    const ok = evaluateListingHealth({
      listingId: "l2",
      productId: "p2",
      sellingPriceCents: 7000,
      supplierPriceCents: 5000,
      netGainCents: eco.netPartnerGainCents,
      refundRisk: risk,
    })
    expect(ok.status).toBe("ok")
    const trend = detectRefundTrend({ purchases: 80, refunds: 24 }, { purchases: 400, refunds: 32 })
    const rising = evaluateListingHealth({
      listingId: "l3",
      productId: "p3",
      sellingPriceCents: 7000,
      supplierPriceCents: 5000,
      netGainCents: eco.netPartnerGainCents,
      refundRisk: risk,
      refundTrend: trend,
    })
    expect(rising.status).toBe("action")
    const thinEco = buildAffiliateCatalogCardEconomics(3000, 5, {
      listedSellingPriceCents: 3400,
    })
    const thin = evaluateListingHealth({
      listingId: "l4",
      productId: "p4",
      sellingPriceCents: 3400,
      supplierPriceCents: 3000,
      netGainCents: thinEco.netPartnerGainCents,
      refundRisk: risk,
    })
    expect(thin.guard.level).toBe("thin")
    expect(thin.status).toBe("watch")
    expect(sortListingHealth([ok, thin, rising]).map((h) => h.listingId)).toEqual(["l3", "l4", "l2"])
  })
})

describe("risk context loader (journal S2)", () => {
  beforeEach(() => {
    vi.stubEnv("EVENTS_JOURNAL", "on")
    queryRaw.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it("journal off = full rollback: defaults, nothing read", async () => {
    vi.stubEnv("EVENTS_JOURNAL", "")
    const ctx = await loadProductRiskContext([{ id: "prod_aaaaaa", categoryId: "cat_1", supplierId: "sup_1" }])
    expect(ctx.get("prod_aaaaaa")?.refundRisk.rate).toBe(DEFAULT_EXPECTED_REFUND_RATE)
    expect(ctx.get("prod_aaaaaa")?.supplierRefundRate).toBeNull()
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it("combines product, category and supplier counts (BigInt counts from Postgres)", async () => {
    queryRaw
      .mockResolvedValueOnce([
        {
          key: "prod_aaaaaa",
          eventType: "purchase",
          recent: true,
          n: BigInt(30),
        },
        {
          key: "prod_aaaaaa",
          eventType: "purchase",
          recent: false,
          n: BigInt(10),
        },
        { key: "prod_aaaaaa", eventType: "refund", recent: true, n: BigInt(4) },
      ])
      .mockResolvedValueOnce([
        { key: "cat_1", eventType: "purchase", recent: false, n: BigInt(1000) },
        { key: "cat_1", eventType: "refund", recent: false, n: BigInt(200) },
      ])
      .mockResolvedValueOnce([
        { key: "sup_1", eventType: "purchase", recent: false, n: BigInt(100) },
        { key: "sup_1", eventType: "refund", recent: false, n: BigInt(5) },
      ])
    const ctx = await loadProductRiskContext([
      { id: "prod_aaaaaa", categoryId: "cat_1", supplierId: "sup_1" },
      { id: "prod_bbbbbb", categoryId: "cat_1", supplierId: null },
    ])
    const a = ctx.get("prod_aaaaaa")!
    expect(a.recentPurchases).toBe(30)
    expect(a.refundRisk.rate).toBeCloseTo(
      estimateRefundRisk({
        product: { purchases: 40, refunds: 4 },
        category: { purchases: 1000, refunds: 200 },
      }).rate,
      10,
    )
    expect(a.supplierRefundRate).toBeCloseTo((5 + 20 * 0.1) / 120, 10)
    // No own sales: the category's measured rate, not the default.
    expect(ctx.get("prod_bbbbbb")!.refundRisk.rate).toBeCloseTo(
      categoryRefundRate({ purchases: 1000, refunds: 200 }),
      10,
    )
    expect(queryRaw).toHaveBeenCalledTimes(3)
  })

  it("never throws: unavailable journal -> defaults", async () => {
    queryRaw.mockRejectedValue(new Error("relation does not exist"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const ctx = await loadProductRiskContext([{ id: "prod_aaaaaa", categoryId: "c", supplierId: "s" }])
    expect(ctx.get("prod_aaaaaa")?.refundRisk.rate).toBe(DEFAULT_EXPECTED_REFUND_RATE)
    expect(warn).toHaveBeenCalled()
  })
})

describe("listing health loader", () => {
  beforeEach(() => vi.stubEnv("EVENTS_JOURNAL", ""))
  afterEach(() => vi.unstubAllEnvs())

  it("evaluates each listing at the reseller's OWN price, most urgent first", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "l_ok",
        sellingPriceCents: 7000,
        product: {
          id: "p_ok",
          name: "OK",
          basePriceCents: 5000,
          commissionRate: 20,
          categoryId: null,
          supplierId: "s",
          variants: null,
        },
      },
      {
        id: "l_bad",
        sellingPriceCents: 4900,
        product: {
          id: "p_bad",
          name: "Bad",
          basePriceCents: 5000,
          commissionRate: 10,
          categoryId: null,
          supplierId: "s",
          variants: null,
        },
      },
    ])
    const rows = await loadResellerListingHealth("aff_1")
    expect(rows.map((r) => r.listingId)).toEqual(["l_bad", "l_ok"])
    expect(rows[0]!.issues).toContain("supplier_price_at_or_above_selling")
    expect(rows[1]!.status).toBe("ok")
    expect(rows[1]!.netGainCents).toBe(
      buildAffiliateCatalogCardEconomics(5000, 20, {
        listedSellingPriceCents: 7000,
      }).netPartnerGainCents,
    )
  })

  it("never throws", async () => {
    findMany.mockRejectedValueOnce(new Error("db down"))
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(await loadResellerListingHealth("aff_1")).toEqual([])
  })
})

describe("opportunity pulse ranking (wired)", () => {
  it("drops products the guard refuses and orders the rest by score, not by viewers alone", async () => {
    vi.resetModules()
    const prismaMock = {
      affiliateProduct: { findMany: vi.fn().mockResolvedValue([]) },
      affisellTrackEvent: {
        findMany: vi.fn().mockResolvedValue([
          // p_thin is the most watched, p_rich the least.
          ...["u1", "u2", "u3", "u4"].map((userId) => ({
            productId: "p_thin",
            userId,
          })),
          ...["u1", "u2", "u3"].map((userId) => ({
            productId: "p_poor",
            userId,
          })),
          ...["u1", "u2"].map((userId) => ({ productId: "p_rich", userId })),
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue(["u1", "u2", "u3", "u4"].map((id) => ({ id }))),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "p_thin",
            name: "Thin",
            images: [],
            basePriceCents: 2000,
            commissionRate: 10,
            variants: null,
            affiliateProducts: [],
            supplier: { email: "a@x.io", store: null },
            categoryId: null,
            supplierId: "s",
          },
          {
            id: "p_poor",
            name: "Poor",
            images: [],
            basePriceCents: 300,
            commissionRate: 0,
            variants: null,
            affiliateProducts: [],
            supplier: { email: "a@x.io", store: null },
            categoryId: null,
            supplierId: "s",
          },
          {
            id: "p_rich",
            name: "Rich",
            images: [],
            basePriceCents: 8000,
            commissionRate: 25,
            variants: null,
            affiliateProducts: [],
            supplier: { email: "a@x.io", store: null },
            categoryId: null,
            supplierId: "s",
          },
        ]),
      },
      $queryRaw: vi.fn(),
    }
    vi.doMock("@/lib/prisma", () => ({ prisma: prismaMock }))
    vi.stubEnv("EVENTS_JOURNAL", "")
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    const { loadAffiliateOpportunityPulsePicks } = await import("@/lib/affiliate-catalog-opportunity-pulse")
    const picks = await loadAffiliateOpportunityPulsePicks("aff_me", 3)
    expect(picks.map((p) => p.productId)).toEqual(["p_rich", "p_thin"])
    expect(picks[0]!.riskAdjustedNetCents).toBeGreaterThan(picks[1]!.riskAdjustedNetCents)
    expect(picks.every((p) => p.refundRiskSource === "default")).toBe(true)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled() // journal off: nothing read
    vi.unstubAllEnvs()
    vi.doUnmock("@/lib/prisma")
  })
})
