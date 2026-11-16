import { netPerSaleCents } from "@/lib/intelligence/price-simulation"
import type { DeclineReason, ResellerPerformance } from "@/lib/intelligence/reseller-performance"

/**
 * Proactive profitability alerts for ONE reseller — pure detection (commercial intelligence).
 *
 * Input: the reseller's own performance (lib/intelligence/reseller-performance.ts), which already splits a decline
 * between its drivers (lib/intelligence/profit-attribution.ts). This module only decides WHICH declines deserve an alert
 * and builds an explainable payload. Nothing is recomputed differently from the screen.
 *
 * THRESHOLDS — and why (all on the reseller's OWN orders, 30 days vs the 30 before):
 *  - The product was really earning: ≥ 5 orders AND ≥ 20 € net in the earlier period. Below that a "decline" is a few
 *    euros moving between two small samples — noise, not a signal worth interrupting someone for.
 *  - The decline is material: ≥ 10 € AND ≥ 25 % of the earlier net. Both: 10 € on a 1 000 € product is noise, 25 % of 8 €
 *    is pocket change.
 *  - At least one cause is ESTABLISHED by the data, each with its own reliability rule:
 *      · volume_down — sales are counts, so a drop is only believed when it is outside ordinary randomness: current orders
 *        ≤ earlier orders − 2·√(earlier orders) (≈ 2 standard deviations of a Poisson count; 10 → ≤ 3, 25 → ≤ 15). A
 *        dip from 6 to 4 orders is not an alert.
 *      · your_price_down / collected_price_down / supplier_price_up / commission_down / fees_up — these come from the
 *        amounts recorded on the orders (deterministic), so ≥ 3 current orders suffice to establish them.
 *      · refunds_up — refunds are rare events: ≥ 5 current orders and ≥ 2 refunded current orders (one refund is a
 *        one-off, not a trend).
 *      · disputes_up — reported alongside an established cause, never alone (a dispute is one buyer, not a trend).
 *    The attribution already ignores drivers worth < 10 % of the decline (or < 1 €). A decline with no established cause
 *    (only "unexplained" money) raises NO alert: we never present a guess as a finding.
 *  - At most ONE alert per reseller and product per 14 days (cooldown, enforced again by a unique key in the database):
 *    a still-declining product is not re-announced every day.
 */
export const ALERT_MIN_PREVIOUS_ORDERS = 5
export const ALERT_MIN_PREVIOUS_NET_CENTS = 2000
export const ALERT_MIN_DECLINE_CENTS = 1000
export const ALERT_MIN_DECLINE_SHARE_BPS = 2500
export const ALERT_MIN_CURRENT_ORDERS_FOR_UNIT_CAUSES = 3
export const ALERT_MIN_CURRENT_ORDERS_FOR_REFUNDS = 5
export const ALERT_MIN_REFUNDED_ORDERS = 2
export const ALERT_COOLDOWN_DAYS = 14

/** The causes an alert may name, most actionable first (the first one is the alert's "primary cause"). */
export const ALERT_CAUSE_ORDER: DeclineReason[] = [
  "supplier_price_up",
  "your_price_down",
  "collected_price_down",
  "commission_down",
  "fees_up",
  "refunds_up",
  "volume_down",
  "disputes_up",
]

export type ProfitAlertSuggestion =
  | { kind: "restore_markup"; priceCents: number; netPerSaleCents: number; salesToMatch30: number | null }
  | { kind: "previous_price"; priceCents: number; netPerSaleCents: number; salesToMatch30: number | null }
  | { kind: "none" }

export type ProfitAlertCandidate = {
  productId: string
  listingId: string | null
  name: string
  primaryCause: DeclineReason
  causes: DeclineReason[]
  previousNetCents: number
  currentNetCents: number
  netChangeCents: number
  previousOrders: number
  currentOrders: number
  /** When the decline can be dated from a recorded event (price cut, supplier price change), else the period start. */
  sinceIso: string
  sinceKind: "price_cut" | "supplier_price_change" | "period_start"
  periodStartIso: string
  periodEndIso: string
  /** Euro amounts per driver, straight from the attribution (for the explanation). */
  effects: Record<string, number>
  suggestion: ProfitAlertSuggestion
  /** Reseller-scoped idempotency key: one alert per product and 14-day bucket. */
  dedupeKey: string
}

export function cooldownBucket(now: Date): number {
  return Math.floor(now.getTime() / (ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000))
}

/** Is a drop in order counts outside ordinary randomness (≈ 2σ of a Poisson count)? */
export function volumeDropIsReliable(previousOrders: number, currentOrders: number): boolean {
  if (previousOrders < ALERT_MIN_PREVIOUS_ORDERS) return false
  return currentOrders <= previousOrders - 2 * Math.sqrt(previousOrders)
}

function causeIsEstablished(cause: DeclineReason, d: ResellerPerformance["declining"][number]): boolean {
  switch (cause) {
    case "volume_down":
      return volumeDropIsReliable(d.previous.orders, d.current.orders)
    case "refunds_up":
      return d.current.orders >= ALERT_MIN_CURRENT_ORDERS_FOR_REFUNDS && d.current.refundedOrders >= ALERT_MIN_REFUNDED_ORDERS
    case "disputes_up":
      return false // never on its own; added back below as a companion
    default:
      return d.current.orders >= ALERT_MIN_CURRENT_ORDERS_FOR_UNIT_CAUSES
  }
}

export function detectProfitAlerts(input: {
  performance: Pick<ResellerPerformance, "declining" | "simulations">
  now: Date
  periodStart: Date
}): ProfitAlertCandidate[] {
  const out: ProfitAlertCandidate[] = []
  const bucket = cooldownBucket(input.now)
  for (const d of input.performance.declining) {
    if (d.previous.orders < ALERT_MIN_PREVIOUS_ORDERS) continue
    if (d.previous.netCents < ALERT_MIN_PREVIOUS_NET_CENTS) continue
    const decline = -d.netChangeCents
    if (decline < ALERT_MIN_DECLINE_CENTS) continue
    if (decline * 10_000 < d.previous.netCents * ALERT_MIN_DECLINE_SHARE_BPS) continue

    const established = d.reasons.filter((r) => causeIsEstablished(r, d))
    if (established.length === 0) continue
    if (d.reasons.includes("disputes_up")) established.push("disputes_up")
    const causes = ALERT_CAUSE_ORDER.filter((c) => established.includes(c))
    const primaryCause = causes[0]!

    let since = { iso: input.periodStart.toISOString(), kind: "period_start" as ProfitAlertCandidate["sinceKind"] }
    if (primaryCause === "your_price_down" && d.priceCutEvidence.length > 0) {
      since = { iso: d.priceCutEvidence[0]!.at, kind: "price_cut" }
    } else if (primaryCause === "supplier_price_up" && d.supplierPriceChange && d.supplierPriceChange.toCents > d.supplierPriceChange.fromCents) {
      since = { iso: d.supplierPriceChange.at, kind: "supplier_price_change" }
    }

    const sim = input.performance.simulations.find((s) => s.productId === d.productId && s.status === "ok")
    let suggestion: ProfitAlertSuggestion = { kind: "none" }
    if (sim && primaryCause === "supplier_price_up" && sim.restoreMarkup) {
      suggestion = {
        kind: "restore_markup",
        priceCents: sim.restoreMarkup.priceCents,
        netPerSaleCents: sim.restoreMarkup.netPerSaleCents,
        salesToMatch30: sim.restoreMarkup.salesToMatchCents30,
      }
    } else if (sim && primaryCause === "your_price_down" && d.priceCutEvidence.length > 0) {
      const previousPrice = d.priceCutEvidence[0]!.fromCents
      const net = netPerSaleCents({
        priceCents: previousPrice,
        supplierPriceCents: sim.assumptions.supplierPriceCents,
        commissionBps: sim.assumptions.commissionBps,
        feeShareBps: sim.assumptions.feeShareBps,
        refundShareBps: sim.assumptions.refundShareBps,
      })
      suggestion = {
        kind: "previous_price",
        priceCents: previousPrice,
        netPerSaleCents: net,
        salesToMatch30: net > 0 && sim.assumptions.observedNet30Cents > 0 ? Math.ceil(sim.assumptions.observedNet30Cents / net) : null,
      }
    }

    out.push({
      productId: d.productId,
      listingId: d.listingId,
      name: d.name,
      primaryCause,
      causes,
      previousNetCents: d.previous.netCents,
      currentNetCents: d.current.netCents,
      netChangeCents: d.netChangeCents,
      previousOrders: d.previous.orders,
      currentOrders: d.current.orders,
      sinceIso: since.iso,
      sinceKind: since.kind,
      periodStartIso: input.periodStart.toISOString(),
      periodEndIso: input.now.toISOString(),
      effects: { ...d.attribution.effects, residual: d.attribution.residualCents },
      suggestion,
      dedupeKey: `${d.productId}:${bucket}`,
    })
  }
  return out
}
