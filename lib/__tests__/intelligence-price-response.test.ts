import { describe, expect, it } from "vitest"

import {
  impliedTenPercentCut,
  measurePriceEvents,
  poolPriceResponse,
  priceResponseSignals,
  PR_MIN_EVENTS,
  type ListingOrder,
  type PriceChange,
} from "@/lib/strategic-intelligence/price-response"

const DAY = 86_400_000
const now = new Date("2026-11-18T12:00:00Z")
const dataFrom = new Date(now.getTime() - 60 * DAY)
const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY)

/** `n` orders spread over [fromDaysAgo, toDaysAgo). */
function orders(listingId: string, productId: string, n: number, fromDaysAgo: number, toDaysAgo: number): ListingOrder[] {
  return Array.from({ length: n }, (_, i) => ({ listingId, productId, paidAt: at(fromDaysAgo - ((fromDaysAgo - toDaysAgo) * (i + 0.5)) / n) }))
}

/** One natural experiment: listing L of product P changes its price 30 days ago; a control listing C does not. */
function experiment(p: string, before: number, after: number, ctrlBefore: number, ctrlAfter: number, from = 1000, to = 900) {
  const change: PriceChange = { listingId: `L-${p}`, productId: p, at: at(30), fromCents: from, toCents: to }
  const o = [
    ...orders(`L-${p}`, p, before, 44, 30),
    ...orders(`L-${p}`, p, after, 30, 16),
    ...orders(`C-${p}`, p, ctrlBefore, 44, 30),
    ...orders(`C-${p}`, p, ctrlAfter, 30, 16),
  ]
  return { change, o }
}

describe("price events — difference-in-differences against the same product's other resellers", () => {
  it("a product-wide surge is NOT credited to the price cut", () => {
    // Listing doubles, but so does the control: no price effect.
    const { change, o } = experiment("p1", 10, 20, 10, 20)
    const { events } = measurePriceEvents([change], o, { now, dataFrom })
    expect(events).toHaveLength(1)
    expect(events[0]!.d).toBeCloseTo(0, 5)
  })

  it("a cut followed by more orders than the control gives a negative elasticity", () => {
    const { change, o } = experiment("p2", 10, 20, 10, 10)
    const e = measurePriceEvents([change], o, { now, dataFrom }).events[0]!
    expect(e.d).toBeGreaterThan(0)
    expect(e.elasticity).toBeLessThan(0) // price down, orders up
  })

  it("excludes what is not an experiment, and says why", () => {
    const tiny: PriceChange = { listingId: "Lt", productId: "pt", at: at(30), fromCents: 1000, toCents: 990 }
    const recent: PriceChange = { listingId: "Lr", productId: "pr", at: at(5), fromCents: 1000, toCents: 800 }
    const first: PriceChange = { listingId: "Lo", productId: "po", at: at(30), fromCents: 1000, toCents: 800 }
    const second: PriceChange = { listingId: "Lo", productId: "po", at: at(25), fromCents: 800, toCents: 700 }
    const lonely = experiment("pl", 10, 12, 0, 0)
    const { events, excluded } = measurePriceEvents([tiny, recent, first, second, lonely.change], lonely.o, { now, dataFrom })
    expect(events).toHaveLength(0)
    expect(excluded).toMatchObject({ small_change: 1, window_incomplete: 1, overlapping_change: 2, no_control: 1 })
  })

  it("a control listing whose own price moved is not a control", () => {
    const { change, o } = experiment("pc", 10, 20, 10, 10)
    const ctrlChange: PriceChange = { listingId: "C-pc", productId: "pc", at: at(28), fromCents: 1000, toCents: 1200 }
    const { excluded } = measurePriceEvents([change, ctrlChange], o, { now, dataFrom })
    expect(excluded.no_control).toBeGreaterThanOrEqual(1)
  })
})

describe("pooling and verdicts — a conclusion only when the whole interval is on one side", () => {
  const strongCuts = Array.from({ length: 8 }, (_, i) => experiment(`s${i}`, 20, 40, 20, 20))
  const pooled = (xs: ReturnType<typeof experiment>[]) =>
    poolPriceResponse(measurePriceEvents(xs.map((x) => x.change), xs.flatMap((x) => x.o), { now, dataFrom }).events)

  it("below the minimum number of events: no pool", () => {
    expect(pooled(strongCuts.slice(0, PR_MIN_EVENTS - 1))).toBeNull()
  })

  it("orders doubling after a 10 % cut, every time: ELASTIC", () => {
    const r = pooled(strongCuts)!
    expect(r.verdict).toBe("elastic")
    expect(r.cuts).toBe(8)
    expect(r.elasticity + 2 * r.se).toBeLessThan(-1)
  })

  it("noise around zero: undetermined — and no signal claims 'no effect'", () => {
    const noisy = Array.from({ length: 8 }, (_, i) => experiment(`n${i}`, 6, i % 2 ? 7 : 5, 6, 6))
    const r = pooled(noisy)!
    expect(r.verdict).toBe("undetermined")
    const sig = priceResponseSignals([{ key: "all", label: "Marketplace", events: measurePriceEvents(noisy.map((x) => x.change), noisy.flatMap((x) => x.o), { now, dataFrom }).events }], { observed: 8, usable: 8, excluded: { small_change: 0, window_incomplete: 0, overlapping_change: 0, too_few_listing_orders: 0, no_control: 0 } }, { observedAt: now.toISOString(), window: { from: dataFrom.toISOString(), to: now.toISOString() } })
    expect(sig.map((s) => s.id)).toEqual(["commercial:price_response:coverage"])
    expect(JSON.stringify(sig)).not.toMatch(/aucun effet|no effect/i)
  })
})

describe("signal wording", () => {
  it("states the measured response, its interval, the method and the causal caveat; never changes a price", () => {
    const xs = Array.from({ length: 8 }, (_, i) => experiment(`w${i}`, 20, 40, 20, 20))
    const events = measurePriceEvents(xs.map((x) => x.change), xs.flatMap((x) => x.o), { now, dataFrom }).events
    const [s] = priceResponseSignals([{ key: "root:1", label: "Maison", events }], { observed: 8, usable: 8, excluded: { small_change: 0, window_incomplete: 0, overlapping_change: 0, too_few_listing_orders: 0, no_control: 0 } }, { observedAt: now.toISOString(), window: null as never })
    expect(s!.id).toBe("commercial:price_response:root:1")
    expect(s!.kind).toBe("estimate")
    expect(s!.title).toMatch(/^Maison : la demande réagit fortement au prix/)
    expect(s!.confidenceReason).toMatch(/pas une preuve causale/)
    expect(s!.recommendedAction).toMatch(/aucune modification automatique/)
  })

  it("implied effect of a 10 % cut: elasticity −2 → orders ≈ +23 %, revenue ≈ +11 %", () => {
    const r = impliedTenPercentCut(-2)
    expect(r.ordersPct).toBeCloseTo(23.46, 1)
    expect(r.revenuePct).toBeCloseTo(11.11, 1)
  })
})
