/**
 * Is the copilot right? — PURE accuracy accounting, order by order, with four amounts that are NEVER mixed:
 *
 * | amount            | meaning                                                                                         |
 * | ----------------- | ----------------------------------------------------------------------------------------------- |
 * | `estimatedCents`  | what the copilot's model predicts for THIS sale (its own formula on the checkout snapshot:      |
 * |                   | supplier price, selling price, commission, the reseller's fee rate) — before refunds            |
 * | `settledCents`    | what the SETTLEMENT function computes the reseller is owed for the sale (`netAffiliateTransfer`) |
 * | `dueCents`        | settled − refund obligations recorded against the reseller (ledger CLAWBACK, written when a     |
 * |                   | refund arrives after the payout); 0 for an order voided (refunded / cancelled) before payout    |
 * | `paidCents`       | money that actually MOVED: payout transfers with a Stripe id, minus succeeded Stripe reversals   |
 * | `outstandingCents`| due − paid (> 0 still owed; < 0 over-paid, to be recovered); null while the order is not payable |
 *
 * Model error is `estimated − settled` (same scope: one sale, before refunds) — it measures the PRICE/FEE model.
 * Refund behaviour is measured separately (expected refund rate vs refunded share), never folded into that error.
 */
export type OrderAccuracyInput = {
  orderId: string
  categoryId: string | null
  supplierId: string
  estimatedCents: number
  settledCents: number
  /** Refund obligations recorded against the reseller (ledger CLAWBACK entries). */
  clawbackCents: number
  /** Refunded or cancelled before any payout moved: nothing is owed. */
  voided: boolean
  /** Payout transfers that actually moved (Stripe transfer id present). */
  transferredCents: number
  /** Stripe transfer reversals that succeeded (money pulled back). */
  reversedCents: number
  /** Ledger entries recorded but not transferred (ledger_only rail). */
  recordedNotTransferredCents: number
  payable: boolean
  /** Refund amount on the order (any), for refund calibration. */
  refunded: boolean
  /** Refund rate the copilot assumed for this product (0–1). */
  expectedRefundRate: number
}

export type OrderAccuracyRow = OrderAccuracyInput & {
  dueCents: number
  paidCents: number
  outstandingCents: number | null
  errorCents: number
}

export function accountOrder(o: OrderAccuracyInput): OrderAccuracyRow {
  const dueCents = o.voided ? 0 : Math.max(0, o.settledCents - Math.max(0, o.clawbackCents))
  const paidCents = Math.max(0, o.transferredCents) - Math.max(0, o.reversedCents)
  return {
    ...o,
    dueCents,
    paidCents,
    outstandingCents: o.payable ? dueCents - paidCents : null,
    errorCents: o.estimatedCents - o.settledCents,
  }
}

/** Below this, an average is not reported as reliable (normal approximation of the mean). */
export const ACCURACY_MIN_ORDERS = 30
/** "Accurate" = the model is off by at most this share of what is settled, on average. */
export const ACCURACY_MAX_RELATIVE_ERROR = 0.05
/** An order counts as "exact" within ±max(10 cents, 2 %). */
const EXACT_ABS = 10
const EXACT_REL = 0.02

export type AccuracyStats = {
  orders: number
  /** Mean(estimated − settled), cents: > 0 = the copilot over-promises. */
  biasCents: number
  /** 95 % confidence half-width of the bias (null under 2 orders). */
  biasCi95Cents: number | null
  /** Mean |estimated − settled|, cents. */
  maeCents: number
  /** Σ|error| / Σ settled. */
  relativeError: number | null
  /** Share of orders within ±max(10 cents, 2 %). */
  exactShare: number
  /** Refund calibration: share the copilot expected vs share actually refunded. */
  expectedRefundShare: number
  realisedRefundShare: number
  /** Totals, kept apart on purpose. */
  totals: {
    estimated: number
    settled: number
    due: number
    paid: number
    outstanding: number
    recordedNotTransferred: number
  }
  verdict: "reliable" | "biased" | "imprecise" | "insufficient_data"
}

export function summariseAccuracy(rows: readonly OrderAccuracyRow[]): AccuracyStats {
  const n = rows.length
  const sum = (f: (r: OrderAccuracyRow) => number) => rows.reduce((a, r) => a + f(r), 0)
  const bias = n ? sum((r) => r.errorCents) / n : 0
  const variance = n > 1 ? sum((r) => (r.errorCents - bias) ** 2) / (n - 1) : 0
  const settled = sum((r) => r.settledCents)
  const absErr = sum((r) => Math.abs(r.errorCents))
  const relativeError = settled > 0 ? absErr / settled : null
  const exact = rows.filter(
    (r) => Math.abs(r.errorCents) <= Math.max(EXACT_ABS, EXACT_REL * Math.abs(r.settledCents)),
  ).length
  const ci = n > 1 ? 1.96 * Math.sqrt(variance / n) : null
  const meanSettled = n ? settled / n : 0

  let verdict: AccuracyStats["verdict"] = "insufficient_data"
  if (n >= ACCURACY_MIN_ORDERS && relativeError != null) {
    // Biased: the whole confidence interval sits beyond ±2 % of a typical sale.
    const biased = ci != null && Math.abs(bias) - ci > EXACT_REL * meanSettled
    verdict = biased ? "biased" : relativeError <= ACCURACY_MAX_RELATIVE_ERROR ? "reliable" : "imprecise"
  }
  return {
    orders: n,
    biasCents: Math.round(bias),
    biasCi95Cents: ci == null ? null : Math.round(ci),
    maeCents: n ? Math.round(absErr / n) : 0,
    relativeError,
    exactShare: n ? exact / n : 0,
    expectedRefundShare: n ? sum((r) => r.expectedRefundRate) / n : 0,
    realisedRefundShare: n ? rows.filter((r) => r.refunded).length / n : 0,
    totals: {
      estimated: sum((r) => r.estimatedCents),
      settled,
      due: sum((r) => r.dueCents),
      paid: sum((r) => r.paidCents),
      outstanding: sum((r) => r.outstandingCents ?? 0),
      recordedNotTransferred: sum((r) => r.recordedNotTransferredCents),
    },
    verdict,
  }
}

/** Accuracy per segment (category, supplier…), largest first; each with its own verdict and volume. */
export function accuracyBy(
  rows: readonly OrderAccuracyRow[],
  key: (r: OrderAccuracyRow) => string | null,
): Array<{ key: string; stats: AccuracyStats }> {
  const groups = new Map<string, OrderAccuracyRow[]>()
  for (const r of rows) {
    const k = key(r) ?? "unknown"
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  return [...groups.entries()]
    .map(([k, list]) => ({ key: k, stats: summariseAccuracy(list) }))
    .sort((a, b) => b.stats.orders - a.stats.orders || a.key.localeCompare(b.key))
}
