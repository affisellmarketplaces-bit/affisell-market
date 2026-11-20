import { DAY_MS, reversedPayoutCents, type PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import { RESELLER_PLATFORM_FEE_BPS } from "@/lib/money/sale-split"

/**
 * What a reseller's own price changes did, and what other prices would pay per sale — pure. Two tools, both labelled
 * for what they are:
 *
 *  - IMPACT OF A PAST CHANGE (observed): the reseller's orders of that product in the 30 days before a recorded change
 *    of their listing price vs the days after it (up to 30, cut at the next change). Units per day, net per sale, net
 *    per day. It is an observation over two periods: it does not prove the price caused the difference (season,
 *    promotion, supplier stock… are not controlled), and the screen says so.
 *
 *  - SIMULATION (computed, never a forecast): at the CURRENT supplier price, commission and fees, and the reseller's own
 *    refund share, the settlement formula gives the net per sale of a few candidate prices, and the number of sales each
 *    would need to earn what the last 30 days earned. Nothing predicts how many buyers a price would bring; nothing is
 *    applied — the reseller decides and changes the price themselves.
 */
export const IMPACT_WINDOW_DAYS = 30
export const IMPACT_MIN_ORDERS = 3
export const IMPACT_MIN_DAYS_AFTER = 7
export const SIMULATION_MIN_ORDERS = 5
export const SIMULATION_STEPS_BPS = [-1000, -500, 0, 500, 1000] as const

export type ListingPriceChange = {
  affiliateProductId: string
  productId: string
  variantKey: string | null
  priceCents: number | null
  previousCents: number | null
  source: string
  effectiveAt: Date
}

export type WindowFigures = {
  days: number
  orders: number
  units: number
  netCents: number
  netPerUnitCents: number | null
  unitsPerDayX100: number
  netPerDayCents: number
}

export type PriceChangeImpact = {
  productId: string
  fromCents: number | null
  toCents: number | null
  source: string
  effectiveAt: string
  status: "measured" | "too_recent" | "insufficient_orders"
  before: WindowFigures
  after: WindowFigures
}

function windowFigures(facts: PaidOrderFact[], from: number, to: number): WindowFigures {
  const days = Math.max(0, (to - from) / DAY_MS)
  let orders = 0
  let units = 0
  let net = 0
  for (const f of facts) {
    const t = f.paidAt.getTime()
    if (t < from || t >= to) continue
    orders += 1
    units += Math.max(1, Math.round(f.quantity) || 1)
    net += f.affiliatePayoutCents - reversedPayoutCents(f.affiliatePayoutCents, f.refundedCents, f.chargedCents)
  }
  return {
    days: Math.round(days * 10) / 10,
    orders,
    units,
    netCents: net,
    netPerUnitCents: units > 0 ? Math.round(net / units) : null,
    unitsPerDayX100: days > 0 ? Math.round((units / days) * 100) : 0,
    netPerDayCents: days > 0 ? Math.round(net / days) : 0,
  }
}

/**
 * Impact of each listing-price change (listing price only, variantKey NULL) on the reseller's own orders of that
 * product. `changes` must be this reseller's; `factsByProduct` this reseller's orders.
 */
export function measurePriceChanges(args: {
  changes: ListingPriceChange[]
  factsByProduct: Map<string, PaidOrderFact[]>
  now: Date
}): PriceChangeImpact[] {
  const now = args.now.getTime()
  const listing = args.changes
    .filter((c) => c.variantKey === null && c.previousCents !== null && c.priceCents !== null)
    .sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime())
  const out: PriceChangeImpact[] = []
  for (let i = 0; i < listing.length; i++) {
    const ch = listing[i]!
    const t = ch.effectiveAt.getTime()
    const next = listing.slice(i + 1).find((n) => n.affiliateProductId === ch.affiliateProductId)
    const end = Math.min(t + IMPACT_WINDOW_DAYS * DAY_MS, next ? next.effectiveAt.getTime() : Infinity, now)
    const prev = [...listing.slice(0, i)].reverse().find((n) => n.affiliateProductId === ch.affiliateProductId)
    const start = Math.max(t - IMPACT_WINDOW_DAYS * DAY_MS, prev ? prev.effectiveAt.getTime() : -Infinity)
    const facts = args.factsByProduct.get(ch.productId) ?? []
    const before = windowFigures(facts, start, t)
    const after = windowFigures(facts, t, end)
    const status: PriceChangeImpact["status"] =
      (end - t) / DAY_MS < IMPACT_MIN_DAYS_AFTER
        ? "too_recent"
        : before.orders < IMPACT_MIN_ORDERS || after.orders < IMPACT_MIN_ORDERS
          ? "insufficient_orders"
          : "measured"
    out.push({
      productId: ch.productId,
      fromCents: ch.previousCents,
      toCents: ch.priceCents,
      source: ch.source,
      effectiveAt: ch.effectiveAt.toISOString(),
      status,
      before,
      after,
    })
  }
  return out.reverse() // most recent first
}

export type SimulationInput = {
  productId: string
  /** Listing price today (HT, cents). */
  currentPriceCents: number
  /** Supplier price today (cents) and the commission the supplier offers today (percent, as stored). */
  supplierPriceCents: number
  commissionPercent: number
  /** Affisell's reseller fee share observed on this reseller's orders (bps), null = the standard rate. */
  feeShareBps: number | null
  /** Refund share by value on this reseller's orders of the product (bps). */
  refundShareBps: number
  /** What the last 30 days really earned on this product, and how many orders. */
  observedNet30Cents: number
  orders30: number
  /** Supplier price at the start of the period, to detect a squeezed markup. */
  supplierPriceAtPeriodStartCents: number | null
  /** The reseller already changed the listing price during the period: no "restore markup" point then. */
  listingPriceChangedInPeriod?: boolean
}

export type SimulationPoint = {
  priceCents: number
  changeBps: number
  netPerSaleCents: number
  /** Sales needed to earn what the last 30 days earned at this price (null when a sale earns nothing). */
  salesToMatchCents30: number | null
}

export type PriceSimulation = {
  productId: string
  status: "ok" | "insufficient_orders"
  assumptions: {
    supplierPriceCents: number
    commissionBps: number
    feeShareBps: number
    feeShareSource: "observed" | "standard"
    refundShareBps: number
    observedNet30Cents: number
    orders30: number
  }
  grid: SimulationPoint[]
  /** When the supplier price rose during the period: the price that keeps the markup the reseller had in euros. */
  restoreMarkup: SimulationPoint | null
}

/** Net per sale at a given price, with the settlement formula (lib/money/sale-split.ts) and the refund share. */
export function netPerSaleCents(args: {
  priceCents: number
  supplierPriceCents: number
  commissionBps: number
  feeShareBps: number
  refundShareBps: number
}): number {
  const W = Math.max(0, Math.round(args.supplierPriceCents))
  const commission = Math.min(W, Math.round((W * Math.max(0, args.commissionBps)) / 10_000))
  const markup = Math.max(0, Math.round(args.priceCents) - W)
  const gross = commission + markup
  const transfer = gross - Math.round((gross * Math.min(10_000, Math.max(0, args.feeShareBps))) / 10_000)
  return Math.max(0, Math.round((transfer * (10_000 - Math.min(10_000, Math.max(0, args.refundShareBps)))) / 10_000))
}

export function simulatePrices(input: SimulationInput): PriceSimulation {
  const commissionBps = Math.round(Math.max(0, Number(input.commissionPercent) || 0) * 100)
  const feeShareSource = input.feeShareBps != null && input.feeShareBps > 0 ? "observed" : "standard"
  const feeShareBps = feeShareSource === "observed" ? Math.round(input.feeShareBps!) : RESELLER_PLATFORM_FEE_BPS
  const assumptions = {
    supplierPriceCents: input.supplierPriceCents,
    commissionBps,
    feeShareBps,
    feeShareSource: feeShareSource as "observed" | "standard",
    refundShareBps: input.refundShareBps,
    observedNet30Cents: input.observedNet30Cents,
    orders30: input.orders30,
  }
  const point = (priceCents: number): SimulationPoint => {
    const net = netPerSaleCents({
      priceCents,
      supplierPriceCents: input.supplierPriceCents,
      commissionBps,
      feeShareBps,
      refundShareBps: input.refundShareBps,
    })
    return {
      priceCents,
      changeBps: input.currentPriceCents > 0 ? Math.round(((priceCents - input.currentPriceCents) / input.currentPriceCents) * 10_000) : 0,
      netPerSaleCents: net,
      salesToMatchCents30: net > 0 && input.observedNet30Cents > 0 ? Math.ceil(input.observedNet30Cents / net) : null,
    }
  }
  if (input.orders30 < SIMULATION_MIN_ORDERS || input.currentPriceCents <= 0) {
    return { productId: input.productId, status: "insufficient_orders", assumptions, grid: [], restoreMarkup: null }
  }
  const grid = SIMULATION_STEPS_BPS.map((bps) => point(Math.round((input.currentPriceCents * (10_000 + bps)) / 10_000)))
  const rise =
    input.supplierPriceAtPeriodStartCents != null ? input.supplierPriceCents - input.supplierPriceAtPeriodStartCents : 0
  return {
    productId: input.productId,
    status: "ok",
    assumptions,
    grid,
    restoreMarkup: rise > 0 && !input.listingPriceChangedInPeriod ? point(input.currentPriceCents + rise) : null,
  }
}
