import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"

import { loadAppMessages } from "@/lib/i18n-load-messages"
import { SUPPORTED_LOCALES } from "@/lib/i18n-locale"
import { aggregatePaidOrders, DAY_MS, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import type { ListingPriceChange } from "@/lib/intelligence/price-simulation"
import { profitAlertTexts } from "@/lib/intelligence/profit-alert-format"
import { toProfitAlertPayload } from "@/lib/intelligence/profit-alert-types"
import {
  ALERT_CAUSE_ORDER,
  cooldownBucket,
  detectProfitAlerts,
  volumeDropIsReliable,
  type ProfitAlertCandidate,
} from "@/lib/intelligence/profit-alerts"
import { buildResellerPerformance, type ResellerProductInfo } from "@/lib/intelligence/reseller-performance"
import { computeSaleSplit } from "@/lib/money/sale-split"

const now = new Date("2026-11-16T12:00:00Z")
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS)
let seq = 0

function orders(n: number, day: number, o: { S?: number; W?: number; cBps?: number; refundBps?: number; disputed?: boolean } = {}): PaidOrderFact[] {
  const S = o.S ?? 3000
  const W = o.W ?? 2000
  const split = computeSaleSplit({ wholesaleCents: W, commissionBps: o.cBps ?? 1000, markupCents: Math.max(0, S - W), supplierFeeBps: 0 })
  return Array.from({ length: n }, () => ({
    orderId: `o${++seq}`,
    productId: "p1",
    quantity: 1,
    chargedCents: S,
    paidAt: daysAgo(day),
    affiliatePayoutCents: split.resellerPayoutCents,
    refundedCents: Math.round((S * (o.refundBps ?? 0)) / 10_000),
    disputed: o.disputed ?? false,
    sellingCents: S,
    supplierCents: W,
    commissionCents: split.commissionCents,
    feeCents: split.resellerFeeCents,
  }))
}

const info = (over: Partial<ResellerProductInfo> = {}): ResellerProductInfo => ({
  productId: "p1",
  name: "Lampe",
  listed: true,
  buyable: true,
  stock: { units: 10, meaningful: true },
  marginReviewNeeded: false,
  currentBasePriceCents: 2000,
  basePriceAtPeriodStartCents: 2000,
  lastPriceChange: null,
  listingPriceCents: 3000,
  commissionPercent: 10,
  listingId: "l1",
  ...over,
})

function alerts(facts: PaidOrderFact[], over: Partial<ResellerProductInfo> = {}, changes: ListingPriceChange[] = []): ProfitAlertCandidate[] {
  const performance = buildResellerPerformance({
    aggregates: aggregatePaidOrders(facts, { now, periodDays: 30, qualityDays: 60 }),
    products: new Map([["p1", info(over)]]),
    signals: { openDisputesByProduct: new Map(), pendingReturnsByProduct: new Map() },
    now,
    listingChanges: changes,
    factsByProduct: new Map([["p1", facts]]),
    comparisonStart: daysAgo(60),
    periodStart: daysAgo(30),
  })
  return detectProfitAlerts({ performance, now, periodStart: daysAgo(30) })
}

describe("volumeDropIsReliable (≈ 2σ of a Poisson count)", () => {
  it("believes a drop only outside ordinary randomness", () => {
    expect(volumeDropIsReliable(10, 3)).toBe(true) // 10 − 2√10 ≈ 3.7
    expect(volumeDropIsReliable(10, 4)).toBe(false)
    expect(volumeDropIsReliable(25, 15)).toBe(true)
    expect(volumeDropIsReliable(25, 16)).toBe(false)
    expect(volumeDropIsReliable(4, 0)).toBe(false) // too few earlier orders to judge
  })
})

describe("detectProfitAlerts — only reliable, material declines with an established cause", () => {
  it("supplier price up: alert dated from the supplier change, with the 'restore my markup' simulation", () => {
    const facts = [...orders(10, 40), ...orders(10, 5, { W: 2600 })]
    const [a] = alerts(facts, {
      currentBasePriceCents: 2600,
      basePriceAtPeriodStartCents: 2000,
      lastPriceChange: { at: daysAgo(20), fromCents: 2000, toCents: 2600 },
    })
    expect(a).toMatchObject({
      productId: "p1",
      listingId: "l1",
      primaryCause: "supplier_price_up",
      causes: ["supplier_price_up"],
      sinceKind: "supplier_price_change",
      previousOrders: 10,
      currentOrders: 10,
    })
    expect(a!.netChangeCents).toBe(10 * Math.round(0.8 * (0.1 - 1) * 600))
    expect(a!.suggestion).toMatchObject({ kind: "restore_markup", priceCents: 3600 })
  })

  it("the reseller's own cut: alert dated from the cut, simulation at the previous price", () => {
    const facts = [...orders(10, 40), ...orders(10, 5, { S: 2400 })]
    const cut: ListingPriceChange = {
      affiliateProductId: "l1",
      productId: "p1",
      variantKey: null,
      priceCents: 2400,
      previousCents: 3000,
      source: "reseller_ui",
      effectiveAt: daysAgo(25),
    }
    const [a] = alerts(facts, { listingPriceCents: 2400 }, [cut])
    expect(a).toMatchObject({ primaryCause: "your_price_down", sinceKind: "price_cut", sinceIso: daysAgo(25).toISOString() })
    expect(a!.suggestion).toMatchObject({ kind: "previous_price", priceCents: 3000, netPerSaleCents: 960 })
  })

  it("fewer sales: only when the drop is outside randomness", () => {
    expect(alerts([...orders(10, 40), ...orders(3, 5)])[0]).toMatchObject({ primaryCause: "volume_down", suggestion: { kind: "none" } })
    expect(alerts([...orders(10, 40), ...orders(5, 5)])).toEqual([]) // 50 % fewer, but 5 vs 10 can be chance
  })

  it("refunds: needs at least 2 refunded orders among at least 5", () => {
    expect(alerts([...orders(10, 40), ...orders(7, 5), ...orders(3, 5, { refundBps: 10_000 })])[0]!.causes).toEqual(["refunds_up"])
    // a single refunded order among 4 (and 5 → 4 orders is chance): a one-off, not a trend
    const big = { S: 10_000 }
    expect(alerts([...orders(5, 40, big), ...orders(3, 5, big), ...orders(1, 5, { ...big, refundBps: 10_000 })])).toEqual([])
  })

  it("never alerts on a product that was not really earning, or on a small decline", () => {
    expect(alerts([...orders(4, 40), ...orders(0, 5)])).toEqual([]) // < 5 earlier orders
    expect(alerts([...orders(10, 40, { S: 2040 }), ...orders(1, 5, { S: 2040 })])).toEqual([]) // 19.20 € < 20 € earlier net
    expect(alerts([...orders(10, 40), ...orders(10, 5, { S: 2950 })])).toEqual([]) // −320: < 10 € and < 25 %
  })

  it("no established cause (only unexplained money) = no alert", () => {
    const facts = [...orders(10, 40), ...orders(10, 5)]
    for (const f of facts.slice(10)) {
      f.affiliatePayoutCents -= 500
      f.feeCents = (f.feeCents ?? 0) - 125
    }
    expect(alerts(facts)).toEqual([])
  })

  it("disputes are named next to an established cause, never alone", () => {
    const withVolume = alerts([...orders(10, 40), ...orders(1, 5), ...orders(1, 5, { disputed: true })])
    expect(withVolume[0]!.causes).toEqual(["volume_down", "disputes_up"])
  })

  it("one dedupe key per product and 14-day bucket", () => {
    const [a] = alerts([...orders(10, 40), ...orders(2, 5)])
    expect(a!.dedupeKey).toBe(`p1:${cooldownBucket(now)}`)
    expect(cooldownBucket(new Date(now.getTime() + 15 * DAY_MS))).toBeGreaterThan(cooldownBucket(now))
  })
})

describe("alert texts — every cause and suggestion renders in the 8 languages", () => {
  const base = alerts([...orders(10, 40), ...orders(2, 5)])[0]!
  it.each(SUPPORTED_LOCALES)("%s", (locale) => {
    const t = createTranslator({ locale, messages: loadAppMessages(locale), namespace: "affiliate.profitAlerts", timeZone: "UTC" }) as unknown as (
      k: string,
      v?: Record<string, string | number>
    ) => string
    const suggestions = [
      { kind: "none" as const },
      { kind: "restore_markup" as const, priceCents: 3600, netPerSaleCents: 960, salesToMatch30: 9 },
      { kind: "previous_price" as const, priceCents: 3000, netPerSaleCents: 960, salesToMatch30: null },
    ]
    for (const cause of ALERT_CAUSE_ORDER) {
      for (const suggestion of suggestions) {
        for (const sinceKind of ["period_start", "price_cut", "supplier_price_change"] as const) {
          const x = profitAlertTexts(
            { ...toProfitAlertPayload(base), primaryCause: cause, causes: [cause], suggestion, sinceKind },
            t,
            locale
          )
          for (const s of [x.title, x.change, x.since, x.suggestion, x.short, x.disclaimer, ...x.causes]) {
            expect(s).not.toMatch(/affiliate\.profitAlerts|\{[a-zA-Z]+\}/)
            expect(s.length).toBeGreaterThan(3)
          }
        }
      }
    }
  })
})
