import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  BS_MIN_LISTING_DAYS,
  buildBlindSpotReport,
  detectGroups,
  exposureOf,
  rateRatio,
  readBlindSpotsMode,
  simulateCorrections,
  type BlindSpotOrder,
  type BlindSpotProductInput,
} from "@/lib/reseller-copilot/blind-spots"
import { buildSelection, rankGeneric, type SelectionCandidate } from "@/lib/reseller-copilot/selection"

const NOW = new Date("2026-11-23T12:00:00Z")
const DAY = 86_400_000
const ago = (d: number) => new Date(NOW.getTime() - d * DAY)

function cand(id: string, over: Partial<SelectionCandidate> = {}): SelectionCandidate {
  return {
    productId: id,
    name: `Produit ${id}`,
    imageUrl: null,
    basePriceCents: 4000,
    commissionRatePct: 10,
    commissionExplicit: true,
    stockUnits: 50,
    stockKnown: true,
    returnWindowDays: 14,
    paidOrders30d: 0,
    resellersListing: 4,
    inMyShop: false,
    awaitingReview: false,
    categoryId: "cat-a",
    categoryName: "Maison",
    ageDays: 120,
    offerMissingMeasured: null,
    ...over,
  }
}

/**
 * `shops` live listings created `listedDaysAgo` days ago; each shop sells at `perDay` orders / day, evenly spaced.
 * `perDayFn(dayAgo)` lets a rate change over time (train vs test window).
 */
function product(
  c: SelectionCandidate,
  shops: number,
  perDay: number | ((dayAgo: number) => number),
  opts: { listedDaysAgo?: number; concentrateOn?: number; prefix?: string } = {},
): BlindSpotProductInput {
  const listed = opts.listedDaysAgo ?? 90
  const rate = typeof perDay === "number" ? () => perDay : perDay
  const listings = Array.from({ length: shops }, (_, s) => ({ affiliateId: `${opts.prefix ?? c.productId}-aff-${s}`, createdAt: ago(listed) }))
  const orders: BlindSpotOrder[] = []
  for (let s = 0; s < shops; s++) {
    let acc = 0
    for (let d = listed - 1; d >= 0; d--) {
      const share = opts.concentrateOn != null ? (s === opts.concentrateOn ? 0.9 * shops : (0.1 * shops) / Math.max(1, shops - 1)) : 1
      acc += rate(d) * share
      while (acc >= 1) {
        acc -= 1
        orders.push({ affiliateId: listings[s]!.affiliateId, paidAt: new Date(ago(d).getTime() - 3600_000), quantity: 1, netCents: 300, closed: false })
      }
    }
  }
  return { candidate: { ...c, resellersListing: shops }, listings, orders, proposals: null }
}

/** 40 high-net « Maison » products (the copilot's favourites) + 20 low-price « Jardin » products that sell 3× more per shop-day. */
function catalogue(): BlindSpotProductInput[] {
  const out: BlindSpotProductInput[] = []
  for (let i = 0; i < 40; i++) out.push(product(cand(`a${String(i).padStart(2, "0")}`, { basePriceCents: 4000 + i * 10 }), 4, 0.05))
  for (let i = 0; i < 20; i++)
    out.push(product(cand(`b${String(i).padStart(2, "0")}`, { basePriceCents: 1000, categoryId: "cat-b", categoryName: "Jardin" }), 4, 0.15))
  return out
}

describe("rankGeneric — the copilot's own order beyond the 12", () => {
  it("is the selection order, uncapped and unpersonalised", () => {
    const cands = catalogue().map((p) => p.candidate)
    const { ranked } = rankGeneric(cands, null)
    expect(ranked).toHaveLength(60)
    const sel = buildSelection(cands, { affiliateFeeBps: null, limit: 12 })
    expect(sel.selection.map((s) => s.productId)).toEqual(ranked.slice(0, 12).map((s) => s.productId))
  })
})

describe("exposure and rate test", () => {
  it("counts listing-days of live listings and only orders after the listing date, closed ones apart", () => {
    const p = product(cand("x"), 2, 0.25, { listedDaysAgo: 20 })
    p.orders = [...p.orders, { affiliateId: "x-aff-0", paidAt: ago(40), quantity: 1, netCents: 300, closed: false }, { affiliateId: "x-aff-1", paidAt: ago(2), quantity: 1, netCents: 0, closed: true }]
    const e = exposureOf(p, ago(90), NOW)
    expect(e.listingDays).toBeCloseTo(40, 0)
    expect(e.orders).toBe(10) // 2 shops × 20 days × 0.25, the order before listing ignored
    expect(e.closedOrders).toBe(1)
    expect(e.matureShops).toBe(0)
  })
  it("rate ratio is one-sided and symmetric in the null", () => {
    const up = rateRatio(30, 100, 10, 100)!
    expect(up.point).toBeGreaterThan(2.5)
    expect(up.p).toBeLessThan(0.01)
    const eq = rateRatio(10, 100, 10, 100)!
    expect(eq.p).toBeCloseTo(0.5, 1)
  })
})

describe("buildBlindSpotReport — synthetic catalogue", () => {
  const products = catalogue()
  // Exposure-driven seller: same rate as the reference, but 40 shops → many orders. NOT an opportunity.
  products.push(product(cand("crowd", { basePriceCents: 1200, categoryId: "cat-c", categoryName: "Sport" }), 40, 0.05))
  // Concentrated: one reseller makes 90 % of the orders → never a confirmed opportunity.
  products.push(product(cand("solo", { basePriceCents: 1000, categoryId: "cat-b", categoryName: "Jardin" }), 4, 0.15, { concentrateOn: 0 }))
  // Never proposed with almost no data → insufficient, never a copilot failure.
  products.push(product(cand("rare", { basePriceCents: 1000, categoryId: "cat-b", categoryName: "Jardin" }), 1, 0.3, { listedDaysAgo: 10 }))
  // Sells very well but quantity ≤ 3 / net too low / unknown stock → never promoted.
  products.push(product(cand("lowstock", { basePriceCents: 1000, categoryId: "cat-b", stockUnits: 2 }), 4, 0.3))
  products.push(product(cand("lownet", { basePriceCents: 300, commissionRatePct: 0, categoryId: "cat-b" }), 4, 0.3))
  products.push(product(cand("unknownstock", { basePriceCents: 1000, categoryId: "cat-b", stockKnown: false }), 4, 0.3))
  const report = buildBlindSpotReport(products, NOW)
  const by = (id: string) => report.products.find((p) => p.productId === id)

  it("explores the whole eligible catalogue, reference = top max(12, 10 %)", () => {
    expect(report.eligible).toBe(63)
    expect(report.topSize).toBe(12)
    expect(report.notEligible).toBe(3)
  })

  it("finds the under-ranked products that sell more per listing-day", () => {
    const confirmed = report.products.filter((p) => p.status === "opportunite_confirmee").map((p) => p.productId)
    expect(confirmed.length).toBeGreaterThanOrEqual(15)
    expect(confirmed.every((id) => id.startsWith("b"))).toBe(true)
    const one = by("b00")!
    expect(one.rateRatio!.lo).toBeGreaterThan(1)
    expect(one.whyBelow).toBe("net") // the copilot ranks it lower because its net per sale is lower
    expect(one.proposalBasis).toBe("reproduit")
    expect(report.rankingBiases.net).toBeGreaterThanOrEqual(15)
  })

  it("separates exposure from performance: many orders from many shops is not an opportunity", () => {
    expect(by("crowd")).toBeUndefined()
    expect(report.statusCounts.opportunite_confirmee).toBe(20 - 0) // 20 jardin products; solo is not confirmed
  })

  it("never confirms an opportunity carried by one reseller", () => {
    expect(by("solo")?.status).toBe("signal_prometteur")
  })

  it("never promotes unsellable / low-net / low-stock / unknown-stock products", () => {
    for (const id of ["lowstock", "lownet", "unknownstock"]) expect(by(id)).toBeUndefined()
    expect(report.statusCounts.non_eligible).toBe(3)
  })

  it("a never-proposed product with little data is insufficient, not a failure", () => {
    expect(report.statusCounts.donnees_insuffisantes).toBeGreaterThanOrEqual(1)
    expect(by("rare")).toBeUndefined()
  })

  it("groups the blind spot: the category the copilot under-represents", () => {
    const g = report.groups.find((x) => x.feature === "categorie=Jardin")!
    expect(g.status).toBe("angle_mort")
    expect(g.topShare).toBe(0)
    expect(g.rate.lo).toBeGreaterThan(1)
  })

  it("never names a product from fewer than 3 shops and carries no reseller identifier", () => {
    const json = JSON.stringify(report)
    expect(json).not.toMatch(/-aff-/)
    expect(json).not.toMatch(/affiliateId/)
  })
})

describe("correction loop — rules found on train, judged on test only", () => {
  it("a lasting blind spot gives a better rule on the separate window", () => {
    const sim = simulateCorrections(catalogue(), NOW)
    const r = sim.rules.find((x) => x.rule === "promouvoir categorie=Jardin")!
    expect(r.verdict).toBe("meilleure")
    expect(r.applied).toBe(false)
    expect(r.test!.inListingDays).toBeGreaterThanOrEqual(BS_MIN_LISTING_DAYS)
    expect(r.regressions).toBe(0)
  })

  it("a pattern present only in the training half is never declared better", () => {
    const products: BlindSpotProductInput[] = []
    for (let i = 0; i < 40; i++) products.push(product(cand(`a${i}`, { basePriceCents: 4000 + i * 10 }), 4, 0.05))
    // Sells 3× more in the older half, the same as everyone in the newer half.
    for (let i = 0; i < 20; i++)
      products.push(product(cand(`f${i}`, { basePriceCents: 1000, categoryId: "cat-f", categoryName: "Mode" }), 4, (d) => (d >= 45 ? 0.15 : 0.05)))
    const sim = simulateCorrections(products, NOW)
    const r = sim.rules.find((x) => x.rule === "promouvoir categorie=Mode")
    expect(r).toBeDefined()
    expect(r!.verdict).not.toBe("meilleure")
  })

  it("no hypothesis without a training-window blind spot", () => {
    const products = Array.from({ length: 40 }, (_, i) => product(cand(`a${i}`, { basePriceCents: 4000 + i * 10 }), 4, 0.05))
    expect(simulateCorrections(products, NOW).reason).toBe("aucune_hypothese_sur_la_periode_d_apprentissage")
  })
})

describe("groups — false discoveries controlled", () => {
  it("a catalogue with no real difference raises no blind spot", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      features: [`categorie=${i % 3}`, `prix=${i % 2}`],
      inTop: i < 12,
      exposure: { listingDays: 360, orders: 18, units: 18, closedOrders: 0, netCents: 0, resellers: 4, sellingResellers: 4, maxResellerShare: 0.25, matureShops: 4, sellingMatureShops: 4 },
    }))
    expect(detectGroups(rows).filter((g) => g.status === "angle_mort")).toHaveLength(0)
  })
})

describe("mode and boundaries", () => {
  it("is off by default", () => {
    expect(readBlindSpotsMode({})).toBe("off")
    expect(readBlindSpotsMode({ COPILOT_BLIND_SPOTS_MODE: "observe" })).toBe("observe")
    expect(readBlindSpotsMode({ COPILOT_BLIND_SPOTS_MODE: "on" })).toBe("off")
  })
  it("the pure module writes nothing and reads no database", () => {
    const src = readFileSync("lib/reseller-copilot/blind-spots.ts", "utf8")
    expect(src).not.toMatch(/prisma|fetch\(|server-only/)
  })
})

describe("admin route", () => {
  it("is ADMIN-only and gated by the mode", () => {
    const src = readFileSync("app/api/admin/copilot-blind-spots/route.ts", "utf8")
    expect(src).toMatch(/requireAdminSession\(\)/)
    expect(src).toMatch(/mode === "off"/)
    expect(src).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
  })
  it("the server reads only — no write call", () => {
    const src = readFileSync("lib/reseller-copilot/blind-spots.server.ts", "utf8")
    expect(src).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/)
  })
})
