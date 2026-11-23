/**
 * Founder brief 2026-11-20 — does sheet quality go with sales? Read-only association measure: stratified
 * Mantel–Haenszel rate ratio (category × price band × age), exposure = listing-days, floors on products and
 * suppliers, positive-only supplier recommendations, access and privacy, 8 locales.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  bonferroniZ,
  buildQualityEffectReport,
  featureValue,
  listingDaysInWindow,
  measureFeature,
  QUALITY_FEATURES,
  QUALITY_LIMITS,
  supplierQualityRecommendations,
  titleIsPrecise,
  type QualityExposure,
  type QualityProduct,
} from "@/lib/listing-quality/quality-effect"

const now = new Date("2026-11-20T00:00:00Z")
const old = new Date("2026-01-01T00:00:00Z")

let n = 0
function product(over: Partial<QualityProduct> = {}): QualityProduct {
  n++
  return {
    id: `p${n}`,
    supplierId: `s${n % 10}`,
    rootCategoryId: "home",
    basePriceCents: 2000,
    createdAt: old,
    imageCount: 1,
    title: "Lampe de bureau LED pliable",
    descriptionText: "",
    specCount: 0,
    variantsDistinct: null,
    gtinValid: false,
    brandDeclared: false,
    deliveryMin: 2,
    deliveryMax: 5,
    returnWindowDays: 14,
    safetyComplete: true,
    physical: true,
    stock: 5,
    stockUnconfirmed: false,
    ...over,
  }
}
const ex = (orders: number, days = 90): QualityExposure => ({ listingDays: days, paidOrders: orders, units: orders, closedOrders: 0 })

/** `count` products × feature on/off with `orders` each, in one stratum. */
function group(count: number, over: Partial<QualityProduct>, orders: number, exposure: Map<string, QualityExposure>) {
  const out: QualityProduct[] = []
  for (let i = 0; i < count; i++) {
    const p = product(over)
    exposure.set(p.id, ex(orders))
    out.push(p)
  }
  return out
}

describe("sheet elements", () => {
  it("reads each element from the sheet, null when not applicable", () => {
    const p = product({ imageCount: 5, descriptionText: "x".repeat(200), specCount: 3, gtinValid: true, brandDeclared: true, returnWindowDays: 30 })
    for (const f of ["photos_3plus", "photos_5plus", "title_precise", "description_200plus", "specs_3plus", "gtin_valid", "brand_declared", "delivery_declared", "return_extended", "safety_complete", "stock_confirmed"] as const) {
      expect(featureValue(f, p)).toBe(true)
    }
    expect(featureValue("variants_distinct", p)).toBeNull()
    expect(featureValue("gtin_valid", product({ physical: false }))).toBeNull()
    expect(featureValue("stock_confirmed", product({ stockUnconfirmed: true }))).toBe(false)
    expect(featureValue("delivery_declared", product({ deliveryMin: 9, deliveryMax: 3 }))).toBe(false)
  })
  it("a precise title has ≥ 3 words, 15–150 characters and is not shouted", () => {
    expect(titleIsPrecise("Lampe de bureau LED pliable")).toBe(true)
    expect(titleIsPrecise("Lampe")).toBe(false)
    expect(titleIsPrecise("LAMPE DE BUREAU LED PLIABLE")).toBe(false)
    expect(titleIsPrecise("a ".repeat(100))).toBe(false)
  })
  it("listing-days are counted inside the window only", () => {
    expect(listingDaysInWindow(old, now)).toBeCloseTo(90)
    expect(listingDaysInWindow(new Date("2026-11-10T00:00:00Z"), now)).toBeCloseTo(10)
    expect(listingDaysInWindow(new Date("2026-12-01T00:00:00Z"), now)).toBe(0)
  })
})

describe("stratified association", () => {
  beforeEach(() => {
    n = 0
  })
  it("a real association inside every stratum is positive, with its interval above 1", () => {
    const e = new Map<string, QualityExposure>()
    const ps = [
      ...group(15, { imageCount: 4 }, 4, e),
      ...group(15, { imageCount: 1 }, 1, e),
      ...group(15, { imageCount: 4, rootCategoryId: "garden" }, 4, e),
      ...group(15, { imageCount: 1, rootCategoryId: "garden" }, 1, e),
    ]
    const r = measureFeature("photos_3plus", ps, e, now, bonferroniZ(12))
    expect(r.verdict).toBe("positive")
    expect(r.estimated.adjustedRatio).toBeCloseTo(4)
    expect(r.estimated.lo!).toBeGreaterThan(1)
    expect(r.measured.informativeStrata).toBe(2)
  })
  it("Simpson: a crude gap made only by the category disappears inside the strata", () => {
    const e = new Map<string, QualityExposure>()
    // Electronics sells a lot and its sheets have photos; garden sells little and mostly has none. Same rate inside each.
    const ps = [
      ...group(25, { imageCount: 4, rootCategoryId: "electronics" }, 5, e),
      ...group(5, { imageCount: 1, rootCategoryId: "electronics" }, 5, e),
      ...group(5, { imageCount: 4, rootCategoryId: "garden" }, 1, e),
      ...group(25, { imageCount: 1, rootCategoryId: "garden" }, 1, e),
    ]
    const r = measureFeature("photos_3plus", ps, e, now, bonferroniZ(12))
    expect(r.estimated.crudeRatio!).toBeGreaterThan(2)
    expect(r.estimated.adjustedRatio).toBeCloseTo(1)
    expect(r.verdict).toBe("unclear")
  })
  it("below the floors nothing is concluded — products, suppliers, orders, strata", () => {
    const e = new Map<string, QualityExposure>()
    const few = [...group(5, { imageCount: 4 }, 4, e), ...group(5, { imageCount: 1 }, 1, e)]
    expect(measureFeature("photos_3plus", few, e, now, 3).reasons).toContain("too_few_products")
    const e2 = new Map<string, QualityExposure>()
    const oneSupplier = [
      ...group(25, { imageCount: 4, supplierId: "solo" }, 4, e2),
      ...group(25, { imageCount: 1 }, 1, e2),
      ...group(25, { imageCount: 4, supplierId: "solo", rootCategoryId: "g" }, 4, e2),
      ...group(25, { imageCount: 1, rootCategoryId: "g" }, 1, e2),
    ]
    const r = measureFeature("photos_3plus", oneSupplier, e2, now, 3)
    expect(r.verdict).toBe("insufficient")
    expect(r.reasons).toContain("too_few_suppliers")
    const e3 = new Map<string, QualityExposure>()
    const oneStratum = [...group(25, { imageCount: 4 }, 4, e3), ...group(25, { imageCount: 1 }, 1, e3)]
    expect(measureFeature("photos_3plus", oneStratum, e3, now, 3).reasons).toContain("too_few_comparable_strata")
  })
  it("products nobody could buy (no listing-day) are left out", () => {
    const e = new Map<string, QualityExposure>()
    const ps = group(30, { imageCount: 4 }, 0, e)
    for (const p of ps) e.set(p.id, ex(0, 0))
    expect(measureFeature("photos_3plus", ps, e, now, 3).measured.productsWith).toBe(0)
  })
  it("refunded / cancelled orders are counted apart, never subtracted", () => {
    const e = new Map<string, QualityExposure>()
    const ps = group(20, { imageCount: 4 }, 2, e)
    for (const p of ps) e.set(p.id, { ...ex(2), closedOrders: 1 })
    const r = measureFeature("photos_3plus", ps, e, now, 3)
    expect(r.measured.ordersWith).toBe(40)
    expect(r.measured.closedWith).toBe(20)
    expect(r.estimated.closedShareWith).toBe(0.5)
  })
  it("a capped read gives no figure at all; limits are always stated", () => {
    const r = buildQualityEffectReport({ products: [product()], exposure: new Map(), now, truncated: true })
    expect(r.effects).toEqual([])
    expect(r.limits).toEqual(QUALITY_LIMITS)
    expect(r.limits).toContain("no_causality")
    expect(r.limits).toContain("views_not_measured")
    expect(buildQualityEffectReport({ products: [], exposure: new Map(), now, truncated: false }).effects).toHaveLength(QUALITY_FEATURES.length)
  })
})

describe("supplier recommendations", () => {
  it("only established associations, only the supplier's own sheets lacking them, ranked by the lower bound × distribution", () => {
    n = 0
    const e = new Map<string, QualityExposure>()
    const ps = [
      ...group(15, { imageCount: 4 }, 4, e),
      ...group(15, { imageCount: 1 }, 1, e),
      ...group(15, { imageCount: 4, rootCategoryId: "garden" }, 4, e),
      ...group(15, { imageCount: 1, rootCategoryId: "garden" }, 1, e),
    ]
    const report = buildQualityEffectReport({ products: ps, exposure: e, now, truncated: false })
    expect(report.effects.find((x) => x.feature === "photos_3plus")?.verdict).toBe("positive")
    const mine = [
      { ...product({ id: "mine-a", imageCount: 1 }), name: "A" },
      { ...product({ id: "mine-b", imageCount: 1 }), name: "B" },
      { ...product({ id: "mine-c", imageCount: 6 }), name: "C" },
    ]
    const own = new Map([
      ["mine-a", { ...ex(1), resellersListing: 1 }],
      ["mine-b", { ...ex(9), resellersListing: 6 }],
    ])
    const recs = supplierQualityRecommendations({ ownProducts: mine, ownExposure: own, report })
    expect(recs.map((r) => r.productId)).toEqual(["mine-b", "mine-a"])
    expect(recs.every((r) => r.feature === "photos_3plus")).toBe(true)
    // An unclear or insufficient element is never recommended.
    const none = supplierQualityRecommendations({ ownProducts: mine, ownExposure: own, report: { ...report, effects: report.effects.map((x) => ({ ...x, verdict: "unclear" as const })) } })
    expect(none).toEqual([])
  })
})

// ── Routes ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: string } } }))
const loader = vi.hoisted(() => ({ supplierCalls: [] as string[] }))
vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: async () => authState.session }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: async () => null }))
vi.mock("@/lib/listing-quality/quality-effect.server", () => ({
  loadQualityEffectReport: async () => ({ windowDays: 90, generatedAt: "x", productsRead: 0, productsWithExposure: 0, truncated: false, bonferroniZ: 3, effects: [], limits: [] }),
  loadSupplierQualityRecommendations: async (supplierId: string) => {
    loader.supplierCalls.push(supplierId)
    return {
      report: {
        windowDays: 90,
        generatedAt: "x",
        limits: ["no_causality"],
        effects: [
          { feature: "photos_3plus", verdict: "positive", estimated: { adjustedRatio: 2, lo: 1.4, hi: 3 }, measured: { suppliersWith: 9, productsWith: 40 } },
          { feature: "gtin_valid", verdict: "unclear", estimated: { adjustedRatio: 1.1, lo: 0.8, hi: 1.5 }, measured: { suppliersWith: 9 } },
        ],
      },
      recommendations: [{ productId: "mine", productName: "A", feature: "photos_3plus", adjustedRatio: 2, lo: 1.4, resellersListing: 1, paidOrders90d: 1, priority: 1 }],
    }
  },
}))
import { GET as adminGet } from "@/app/api/admin/listing-quality-effect/route"
import { GET as supplierGet } from "@/app/api/supplier/listing-quality/route"

describe("access and privacy", () => {
  it("admin report: 401 / 403 / 200", async () => {
    authState.session = null
    expect((await adminGet()).status).toBe(401)
    authState.session = { user: { id: "s1", role: "SUPPLIER" } }
    expect((await adminGet()).status).toBe(403)
    authState.session = { user: { id: "a", role: "ADMIN" } }
    expect((await adminGet()).status).toBe(200)
  })
  it("supplier: own id only, positive evidence only, no counts of other suppliers", async () => {
    authState.session = null
    expect((await supplierGet(new Request("http://x"))).status).toBe(401)
    authState.session = { user: { id: "r1", role: "AFFILIATE" } }
    expect((await supplierGet(new Request("http://x"))).status).toBe(403)
    authState.session = { user: { id: "s1", role: "SUPPLIER" } }
    const body = (await (await supplierGet(new Request("http://x"))).json()) as { evidence: Array<{ feature: string }> }
    expect(loader.supplierCalls).toEqual(["s1"])
    expect(body.evidence.map((e) => e.feature)).toEqual(["photos_3plus"])
    expect(JSON.stringify(body)).not.toMatch(/suppliersWith|productsWith/)
  })
})

describe("8 locales", () => {
  it("every text and every element label exists", () => {
    const fr = JSON.parse(readFileSync(join(process.cwd(), "messages/fr.json"), "utf8")) as { catalogHealth: { listingQuality: { feature: Record<string, string> } } }
    expect(Object.keys(fr.catalogHealth.listingQuality.feature).sort()).toEqual([...QUALITY_FEATURES].sort())
    for (const l of ["en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `messages/${l}.json`), "utf8")) as { catalogHealth: { listingQuality: Record<string, unknown> & { feature: Record<string, string> } } }
      expect(Object.keys(m.catalogHealth.listingQuality).sort()).toEqual(Object.keys(fr.catalogHealth.listingQuality).sort())
      expect(Object.keys(m.catalogHealth.listingQuality.feature).sort()).toEqual([...QUALITY_FEATURES].sort())
    }
  })
})

// ── From measure to action: the supplier's next best action carries the evidence ──────────────────────────────────
import { supplierNextActions } from "@/lib/next-best-action/next-best-action"
import type { HealthIssue, HealthReport } from "@/lib/supplier-catalog-health/diagnose"
import type { QualityRecommendation } from "@/lib/listing-quality/quality-effect"

describe("next best action — sheet improvements backed by the measure", () => {
  const issue = (over: Partial<HealthIssue>): HealthIssue => ({
    code: "few_photos",
    cls: "recommandation",
    productId: "p1",
    productName: "Lampe",
    source: "fiche",
    fix: "edit_product",
    evidence: { photos: 1 },
    demand: { paidOrders30d: 2, resellersListing: 3 },
    impactScore: 10,
    ...over,
  })
  const report = (issues: HealthIssue[]): HealthReport =>
    ({ productsChecked: 1, issues, counts: { blocage: 0, anomalie: 0, avertissement: 0, recommandation: issues.length }, blockedProducts: 0, healthyProducts: 0, truncated: false })
  const rec = (over: Partial<QualityRecommendation>): QualityRecommendation => ({
    productId: "p1",
    productName: "Lampe",
    feature: "photos_3plus",
    adjustedRatio: 2,
    lo: 1.4,
    resellersListing: 3,
    paidOrders90d: 4,
    priority: 1,
    ...over,
  })

  it("a diagnosed gap with an established association carries the ratio and moves from « basse » to « moyenne »", () => {
    const [a] = supplierNextActions(report([issue({})]), 3, [], [rec({})])
    expect(a).toMatchObject({ kind: "complete_sheet", reason: "few_photos", priority: "moyenne", impact: { qualityRatio: 2, qualityRatioLow: 1.4 } })
  })
  it("without evidence nothing changes (same priority, no ratio)", () => {
    const [a] = supplierNextActions(report([issue({})]), 3, [], [])
    expect(a!.priority).toBe("basse")
    expect(a!.impact).not.toHaveProperty("qualityRatio")
  })
  it("an element the health report does not diagnose becomes an action only with evidence and some distribution", () => {
    const [a] = supplierNextActions(report([]), 3, [], [rec({ feature: "specs_3plus" })])
    expect(a).toMatchObject({ kind: "complete_sheet", reason: "quality_specs_3plus", href: "/dashboard/supplier/products/p1/edit" })
    expect(supplierNextActions(report([]), 3, [], [rec({ feature: "specs_3plus", resellersListing: 0, paidOrders90d: 0 })])).toEqual([])
    // Elements owned by other actions (stock, safety, variants) never come in through this door.
    expect(supplierNextActions(report([]), 3, [], [rec({ feature: "stock_confirmed" })])).toEqual([])
  })
  it("every new reason has its text in 8 locales", () => {
    for (const l of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `messages/${l}.json`), "utf8")) as { nextActions: { qualityEvidence: string; reason: Record<string, string> } }
      expect(m.nextActions.qualityEvidence).toContain("{lo}")
      for (const f of ["title_precise", "specs_3plus", "photos_5plus", "brand_declared", "delivery_declared", "return_extended"]) expect(m.nextActions.reason[`quality_${f}`]).toBeTruthy()
    }
  })
})
