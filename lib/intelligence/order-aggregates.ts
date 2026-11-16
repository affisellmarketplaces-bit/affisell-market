/**
 * Pure aggregation of PAID orders into per-product period figures, shared by the platform opportunity board and the
 * per-reseller performance view (commercial intelligence A). One definition of every quantity:
 *
 *  - a period is [now − (k+1)·days, now − k·days) on `paidAt` (k = 0 current, k = 1 previous) — half-open, so an order is
 *    never counted in two periods;
 *  - "charged" = Order.totalCents (what the buyer paid for that line, VAT included), refunded = Σ OrderStripeRefund.amountCents
 *    of that order, capped at what was charged (a refund can never make a line negative);
 *  - a reseller's payout = what the order transfers to them (`netAffiliateTransferCents`: commission + markup − Affisell's
 *    reseller fee — the settlement's own function, NOT `Order.affiliatePayoutCents`, which holds the commission alone);
 *  - a reseller's payout on a refunded order is reversed PRO RATA of the refunded amount — the rule the transfer reversal
 *    applies (`reverseConnectTransfersForRefund`, `computeIncrementalReversalCents` with the order total), so a 30 %
 *    partial refund costs 30 % of the payout, not all of it, and a rejected return (no refund row) costs nothing;
 *  - a dispute = the order has a row in the dispute ledger (`ProcessedWebhook` id `dispute:<dp>:<orderId>`, open, won or
 *    lost) or is currently `disputed` — a won dispute stays a signal even though it cost nothing.
 */
export const DAY_MS = 24 * 60 * 60 * 1000

export type PaidOrderFact = {
  orderId: string
  productId: string
  quantity: number
  chargedCents: number
  paidAt: Date
  /** What the order transfers to the reseller (net of Affisell's reseller fee). */
  affiliatePayoutCents: number
  /** Line amounts from the order snapshot (cents, whole line): HT price collected, supplier price, the supplier's
   * commission to the reseller, Affisell's reseller fee. Optional: absent = 0 (pure tests of the volume logic). */
  sellingCents?: number
  supplierCents?: number
  commissionCents?: number
  feeCents?: number
  refundedCents: number
  disputed: boolean
}

export type PeriodFigures = {
  orders: number
  units: number
  chargedCents: number
  refundedCents: number
  disputedOrders: number
  /** Σ reseller payouts and the share reversed by refunds (pro rata). */
  payoutCents: number
  payoutReversedCents: number
  /** Σ of the line snapshots (see PaidOrderFact). */
  sellingCents: number
  supplierCents: number
  commissionCents: number
  feeCents: number
}

export type ProductAggregate = {
  productId: string
  current: PeriodFigures
  previous: PeriodFigures
  /** Quality window (default 90 days) — always ending now. */
  quality: PeriodFigures
}

export function emptyPeriod(): PeriodFigures {
  return {
    orders: 0,
    units: 0,
    chargedCents: 0,
    refundedCents: 0,
    disputedOrders: 0,
    payoutCents: 0,
    payoutReversedCents: 0,
    sellingCents: 0,
    supplierCents: 0,
    commissionCents: 0,
    feeCents: 0,
  }
}

function int(n: unknown): number {
  const v = Math.round(Number(n))
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** Pro-rata reversal of a payout for a refund on a charge (capped, integer cents). */
export function reversedPayoutCents(payoutCents: number, refundedCents: number, chargedCents: number): number {
  const payout = int(payoutCents)
  const charged = int(chargedCents)
  if (payout === 0 || charged === 0) return 0
  const refunded = Math.min(int(refundedCents), charged)
  return Math.round((payout * refunded) / charged)
}

function add(p: PeriodFigures, f: PaidOrderFact): void {
  const charged = int(f.chargedCents)
  const refunded = Math.min(int(f.refundedCents), charged)
  p.orders += 1
  p.units += Math.max(1, int(f.quantity))
  p.chargedCents += charged
  p.refundedCents += refunded
  if (f.disputed) p.disputedOrders += 1
  p.payoutCents += int(f.affiliatePayoutCents)
  p.payoutReversedCents += reversedPayoutCents(f.affiliatePayoutCents, refunded, charged)
  p.sellingCents += int(f.sellingCents)
  p.supplierCents += int(f.supplierCents)
  p.commissionCents += int(f.commissionCents)
  p.feeCents += int(f.feeCents)
}

/** Sum of several periods (e.g. every product of a reseller). */
export function sumPeriods(list: PeriodFigures[]): PeriodFigures {
  const out = emptyPeriod()
  for (const p of list) {
    for (const k of Object.keys(out) as Array<keyof PeriodFigures>) out[k] += p[k]
  }
  return out
}

export function aggregatePaidOrders(
  facts: PaidOrderFact[],
  opts: { now: Date; periodDays: number; qualityDays: number }
): Map<string, ProductAggregate> {
  const now = opts.now.getTime()
  const period = opts.periodDays * DAY_MS
  const quality = opts.qualityDays * DAY_MS
  const out = new Map<string, ProductAggregate>()
  const seen = new Set<string>()
  for (const f of facts) {
    if (seen.has(f.orderId)) continue // a fact list built from several queries must not double count
    seen.add(f.orderId)
    const t = f.paidAt.getTime()
    if (!Number.isFinite(t) || t > now) continue
    const age = now - t
    if (age >= Math.max(2 * period, quality)) continue
    let agg = out.get(f.productId)
    if (!agg) {
      agg = { productId: f.productId, current: emptyPeriod(), previous: emptyPeriod(), quality: emptyPeriod() }
      out.set(f.productId, agg)
    }
    if (age < period) add(agg.current, f)
    else if (age < 2 * period) add(agg.previous, f)
    if (age < quality) add(agg.quality, f)
  }
  return out
}

/** Net a reseller kept: payouts minus what refunds took back. */
export function netPayoutCents(p: PeriodFigures): number {
  return p.payoutCents - p.payoutReversedCents
}

export function rateBps(part: number, total: number): number {
  return total > 0 ? Math.round((Math.min(Math.max(part, 0), total) / total) * 10_000) : 0
}
