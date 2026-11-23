import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { rebuildPresence, type PresenceEvent } from "@/lib/listing-presence/periods"
import { buildBlindSpotReport, exposureOf, type BlindSpotOrder, type BlindSpotProductInput } from "@/lib/reseller-copilot/blind-spots"
import type { SelectionCandidate } from "@/lib/reseller-copilot/selection"
import {
  buildTemporalReport,
  measurePeriods,
  observationThreshold,
  readTemporalMode,
  TEMPORAL_LIMITS,
  withdrawalReason,
  type TemporalListing,
  type TemporalProduct,
} from "@/lib/reseller-copilot/temporal-opportunities"

const NOW = new Date("2026-11-24T12:00:00Z")
const DAY = 86_400_000
const ago = (d: number) => new Date(NOW.getTime() - d * DAY)
const TRACK = ago(200)

/** Periods as [startDaysAgo, endDaysAgo | null, endSource]. Orders spread evenly at `rate` per listed day. */
function listing(productId: string, affiliateId: string, periods: Array<[number, number | null, string?]>, rate: number | ((p: number) => number)): TemporalListing {
  const events: PresenceEvent[] = []
  periods.forEach(([s, e, src], i) => {
    events.push(i === 0 ? { kind: "created", previousListed: null, newListed: true, effectiveAt: ago(s), source: "listing_create" } : { kind: "listed", previousListed: false, newListed: true, effectiveAt: ago(s), source: "reseller_ui" })
    if (e != null) events.push({ kind: "unlisted", previousListed: true, newListed: false, effectiveAt: ago(e), source: src ?? "reseller_ui" })
  })
  const last = periods.at(-1)!
  const history = rebuildPresence({ current: { isListed: last[1] == null, createdAt: ago(periods[0]![0]) }, events, trackingStartedAt: TRACK })
  const orders: BlindSpotOrder[] = []
  periods.forEach(([s, e], i) => {
    const r = typeof rate === "number" ? rate : rate(i)
    let acc = 0
    // Each order lands 1 h after the start of a day strictly inside the period (never after its end, never in the future).
    for (let d = s - 1; d >= (e ?? 0) + 1; d--) {
      acc += r
      while (acc >= 1) {
        acc -= 1
        orders.push({ affiliateId, paidAt: new Date(ago(d).getTime() + 3600_000), quantity: 1, netCents: 400, closed: false })
      }
    }
  })
  return { productId, affiliateId, history, orders }
}

const prod = (productId: string, eligibleToday = true): TemporalProduct => ({ productId, name: `Produit ${productId}`, eligibleToday })

/** A background catalogue: 30 products × 4 shops, listed 150 days, selling 0.05 / day. */
function background(): { listings: TemporalListing[]; products: TemporalProduct[] } {
  const listings: TemporalListing[] = []
  const products: TemporalProduct[] = []
  for (let i = 0; i < 30; i++) {
    products.push(prod(`bg${i}`))
    for (let s = 0; s < 4; s++) listings.push(listing(`bg${i}`, `bg${i}-a${s}`, [[150, null]], 0.05))
  }
  return { listings, products }
}

describe("withdrawal reasons come from the recorded source, never presumed", () => {
  it("maps sources to reasons", () => {
    expect(withdrawalReason("reseller_ui")).toBe("volontaire")
    expect(withdrawalReason("exclusivity")).toBe("contrainte")
    expect(withdrawalReason("supplier_withdrawal")).toBe("contrainte")
    expect(withdrawalReason("replacement")).toBe("remplacement")
    expect(withdrawalReason("script")).toBe("technique")
    expect(withdrawalReason("unattributed")).toBe("inconnue")
    expect(withdrawalReason(null)).toBe("inconnue")
  })
})

describe("measurePeriods — only periods whose edges are known are judged", () => {
  it("leaves a period older than the history unjudged (incomplete ≠ failure)", () => {
    const events: PresenceEvent[] = [{ kind: "unlisted", previousListed: true, newListed: false, effectiveAt: ago(100), source: "reseller_ui" }]
    const history = rebuildPresence({ current: { isListed: false, createdAt: ago(400) }, events, trackingStartedAt: TRACK })
    const m = measurePeriods({ productId: "x", affiliateId: "a", history, orders: [] }, NOW)
    expect(m.periods).toHaveLength(0)
    expect(m.unjudged).toBe(1)
  })
  it("counts orders inside the period only, marks relistings and first-sale delay", () => {
    const l = listing("x", "a", [[100, 80], [60, null]], (i) => (i === 0 ? 0 : 0.2))
    const m = measurePeriods(l, NOW).periods
    expect(m).toHaveLength(2)
    expect(m[0]).toMatchObject({ orders: 0, ongoing: false, withdrawal: "volontaire", isRelisting: false })
    expect(m[1]).toMatchObject({ ongoing: true, isRelisting: true })
    expect(m[1]!.orders).toBe(l.orders.length)
    expect(m[1]!.orders).toBeGreaterThan(10)
    expect(m[1]!.firstSaleAfterDays).toBeLessThan(6)
  })
})

describe("observation threshold is measured, bounded, and said so", () => {
  it("floor when too few sales", () => {
    expect(observationThreshold([])).toMatchObject({ days: 14, basis: "plancher" })
  })
})

describe("buildTemporalReport — synthetic history", () => {
  const { listings, products } = background()
  // Withdrawn too early (5 days, no sale, voluntary) in 3 shops — sells 3× more where it stayed 120 days (4 shops).
  products.push(prod("early"))
  for (let s = 0; s < 3; s++) listings.push(listing("early", `early-short-${s}`, [[100 - s * 10, 95 - s * 10]], 0))
  for (let s = 0; s < 4; s++) listings.push(listing("early", `early-long-${s}`, [[130, null]], 0.15))
  // Same story, but every short withdrawal was an EXCLUSIVITY (platform constraint): never « too early ».
  products.push(prod("constrained"))
  for (let s = 0; s < 3; s++) listings.push(listing("constrained", `con-short-${s}`, [[100, 95, "exclusivity"]], 0))
  for (let s = 0; s < 4; s++) listings.push(listing("constrained", `con-long-${s}`, [[130, null]], 0.15))
  // Sold very well, all listings withdrawn since, sellable today: invisible to today's-catalogue analyses.
  products.push(prod("ghost"))
  for (let s = 0; s < 4; s++) listings.push(listing("ghost", `ghost-${s}`, [[180, 60]], 0.15))
  // Same but NOT sellable today: never promoted.
  products.push(prod("ghost-blocked", false))
  for (let s = 0; s < 4; s++) listings.push(listing("ghost-blocked", `gb-${s}`, [[180, 60]], 0.15))
  // Carried by one shop (90 % of sales) — never a confirmed opportunity.
  products.push(prod("solo"))
  listings.push(listing("solo", "solo-big", [[180, 60]], 0.6))
  for (let s = 0; s < 3; s++) listings.push(listing("solo", `solo-${s}`, [[180, 60]], 0.02))
  // Relisted by several resellers.
  products.push(prod("back"))
  for (let s = 0; s < 3; s++) listings.push(listing("back", `back-${s}`, [[180, 150], [120, null]], 0.05))

  const r = buildTemporalReport(listings, products, NOW, { trackingStartedAt: TRACK })
  const find = (kind: string, id: string) => r.findings.find((f) => f.kind === kind && f.productId === id)

  it("detects a product withdrawn before it could show anything, while it sells where it stayed", () => {
    const f = find("retrait_premature_probable", "early")!
    expect(f.status).toBe("opportunite_confirmee")
    expect(f.evidence.shortWithdrawals).toBe(3)
    expect(f.evidence.withdrawalReasons).toEqual({ volontaire: 3 })
    expect(f.evidence.rateRatio!.lo).toBeGreaterThan(1)
  })

  it("never calls a constrained withdrawal « too early »", () => {
    expect(find("retrait_premature_probable", "constrained")).toBeUndefined()
    expect(r.comparisons.withdrawalReasons.contrainte).toBe(3)
  })

  it("surfaces a historical opportunity no live listing shows — only if sellable today", () => {
    expect(find("opportunite_historique_invisible", "ghost")?.status).toBe("opportunite_confirmee")
    expect(find("opportunite_historique_invisible", "ghost-blocked")).toBeUndefined()
  })

  it("never confirms an opportunity carried by one reseller", () => {
    const f = find("opportunite_historique_invisible", "solo")
    expect(f?.status).not.toBe("opportunite_confirmee")
  })

  it("reports relistings, biased exposure and the kept-vs-withdrawn comparison", () => {
    expect(find("remises_en_vente_repetees", "back")).toBeDefined()
    expect(find("exposition_faussee", "ghost")).toBeDefined()
    expect(r.comparisons.relistingVsFirst).not.toBeNull()
    expect(r.scope.periodsTooShort).toBeGreaterThanOrEqual(6)
  })

  it("labels every kind of data and never names a shop", () => {
    expect(r.dataKinds).toMatchObject({ presence: "observe", disponibilite: "non_historise", trafic: "non_mesure", exposition_acheteurs: "non_mesure" })
    expect(r.limits).toEqual([...TEMPORAL_LIMITS])
    const json = JSON.stringify(r)
    expect(json).not.toMatch(/-short-|-long-|ghost-\d|solo-big|affiliateId/)
  })
})

describe("false positives", () => {
  it("a history where every product sells alike raises no confirmed opportunity", () => {
    const { listings, products } = background()
    for (let i = 0; i < 10; i++) {
      products.push(prod(`w${i}`))
      for (let s = 0; s < 4; s++) listings.push(listing(`w${i}`, `w${i}-a${s}`, [[180, 60]], 0.05))
    }
    const r = buildTemporalReport(listings, products, NOW, { trackingStartedAt: TRACK })
    expect(r.findings.filter((f) => f.status === "opportunite_confirmee")).toHaveLength(0)
  })
  it("no history = unavailable, nothing computed; a truncated read concludes nothing", () => {
    expect(buildTemporalReport([], [], NOW, { trackingStartedAt: null }).available).toBe(false)
    const t = buildTemporalReport(background().listings, background().products, NOW, { trackingStartedAt: TRACK, truncated: true })
    expect(t.findings).toEqual([])
  })
})

describe("hypotheses are generated on the older half and judged on the newer half only", () => {
  it("withdrawn-too-early products that sell when they stay: confirmed on independent data", () => {
    const listings: TemporalListing[] = []
    const products: TemporalProduct[] = []
    // Background whose later periods (newer half: started < 100 days ago) mostly do not sell.
    for (let i = 0; i < 30; i++) {
      products.push(prod(`b${i}`))
      for (let s = 0; s < 3; s++) listings.push(listing(`b${i}`, `b${i}-${s}`, [[90, null]], i % 4 === 0 ? 0.05 : 0))
    }
    // 10 products withdrawn early in the OLDER half (2 shops each), then kept ≥ 14 days in the newer half and selling.
    for (let i = 0; i < 10; i++) {
      products.push(prod(`e${i}`))
      for (let s = 0; s < 2; s++) listings.push(listing(`e${i}`, `e${i}-old-${s}`, [[190, 186]], 0))
      for (let s = 0; s < 3; s++) listings.push(listing(`e${i}`, `e${i}-new-${s}`, [[80, null]], 0.1))
    }
    const r = buildTemporalReport(listings, products, NOW, { trackingStartedAt: TRACK })
    const h = r.hypotheses.find((x) => x.id === "retraits_prematures_vendent_s_ils_restent")!
    expect(h.generatedOn.products).toBe(10)
    expect(h.verdict).toBe("confirmee")
    expect(h.applied).toBe(false)
    expect(new Date(h.generatedOn.to).getTime()).toBe(new Date(h.testedOn.from).getTime())
  })
  it("too few test periods = insuffisante, never judged", () => {
    const r = buildTemporalReport([listing("a", "a1", [[150, null]], 0.05)], [prod("a")], NOW, { trackingStartedAt: TRACK })
    expect(r.hypotheses.every((h) => h.verdict === "insuffisante")).toBe(true)
  })
})

describe("blind-spot detector reads the presence history when given", () => {
  const cand = (id: string): SelectionCandidate => ({
    productId: id, name: id, imageUrl: null, basePriceCents: 4000, commissionRatePct: 10, commissionExplicit: true, stockUnits: 50, stockKnown: true,
    returnWindowDays: 14, paidOrders30d: 0, resellersListing: 1, inMyShop: false, awaitingReview: false, categoryId: "c", categoryName: "C", ageDays: 200, offerMissingMeasured: null,
  })
  it("counts withdrawn listings' presence and only orders paid while listed", () => {
    const withdrawn = listing("p", "shop-a", [[80, 40]], 0.1)
    const live = listing("p", "shop-b", [[30, null]], 0.1)
    const p: BlindSpotProductInput = {
      candidate: cand("p"),
      listings: [{ affiliateId: "shop-b", createdAt: ago(30) }],
      orders: [...withdrawn.orders, ...live.orders, { affiliateId: "shop-a", paidAt: ago(10), quantity: 1, netCents: 400, closed: false }],
      proposals: null,
      presence: [{ affiliateId: "shop-a", history: withdrawn.history }, { affiliateId: "shop-b", history: live.history }],
    }
    const e = exposureOf(p, ago(90), NOW)
    expect(e.basis).toBe("presence_history")
    expect(e.listingDays).toBeCloseTo(70, 0) // 40 withdrawn + 30 live
    // Every order paid while listed — and not the one paid after shop-a's withdrawal.
    expect(e.orders).toBe(withdrawn.orders.length + live.orders.length)
    expect(e.withdrawnListings).toBe(1)
    const legacy = exposureOf({ ...p, presence: null }, ago(90), NOW)
    expect(legacy.basis).toBe("live_listings")
    expect(legacy.listingDays).toBeCloseTo(30, 0)
  })
  it("the report says which basis each product was judged on; unchanged without history", () => {
    const r = buildBlindSpotReport([{ candidate: cand("q"), listings: [], orders: [], proposals: null }], NOW)
    expect(r.exposureBasis).toMatchObject({ presenceHistory: 0, liveListingsOnly: 1 })
  })
})

describe("mode, wiring and boundaries", () => {
  it("temporal engine is off by default", () => {
    expect(readTemporalMode({})).toBe("off")
    expect(readTemporalMode({ COPILOT_TEMPORAL_MODE: "observe" })).toBe("observe")
    expect(readTemporalMode({ COPILOT_TEMPORAL_MODE: "on" })).toBe("off")
  })
  it("pure module reads nothing; server writes nothing; served by the existing admin route only", () => {
    expect(readFileSync("lib/reseller-copilot/temporal-opportunities.ts", "utf8")).not.toMatch(/prisma|fetch\(|server-only/)
    expect(readFileSync("lib/reseller-copilot/temporal-opportunities.server.ts", "utf8")).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/)
    const route = readFileSync("app/api/admin/copilot-blind-spots/route.ts", "utf8")
    expect(route).toMatch(/requireAdminSession\(\)/)
    expect(route).toMatch(/temporalMode === "off"/)
  })
  it("listing creators, publication and imports declare their presence source", () => {
    for (const [f, src] of [
      ["lib/affiliate-quick-add-listing.server.ts", "listing_create"],
      ["app/api/affiliate/add/route.ts", "listing_create"],
      ["app/api/affiliate/products/add/route.ts", "listing_create"],
      ["lib/supplier-invitation-affiliate-listing.ts", "listing_create"],
      ["lib/product-request-commission.server.ts", "listing_create"],
      ["lib/affiliate-publish-listing.server.ts", "reseller_ui"],
      ["lib/affiliate-url-import.server.ts", "import"],
      ["lib/marketplace/import-from-url.server.ts", "import"],
      ["lib/radar/radar-import-bridge.server.ts", "import"],
      ["scripts/hide-internal-test-products.ts", "script"],
    ] as const) {
      expect(readFileSync(f, "utf8"), f).toMatch(new RegExp(`source: "${src}"|'affisell.listing_presence_source', '${src}'`))
    }
  })
})
