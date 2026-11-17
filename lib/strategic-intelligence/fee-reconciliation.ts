/**
 * Reconciling the two ESTIMATED costs of Affisell's margin with what was really taken — pure, no I/O.
 *
 * 1. Stripe's fee. Affisell estimates 2.9 % + 25 c of the TTC charge (`estimateStripeFeeCents`). The real fee is on the
 *    charge's balance transaction (`fee`, in the settlement currency). A cart's orders share ONE charge: the fee is split
 *    over them pro rata of their charged totals (largest remainder, the parts always add up to the fee).
 * 2. What an AliExpress purchase really cost. Two ways it is paid today:
 *    - the browser/auto-buy path (`lib/fulfillment/auto-buy.ts`) pays with a single-use Stripe Issuing card per order
 *      (`FulfillmentLog.virtualCardId`): the captured Issuing transactions of that card ARE the debit;
 *    - the AliExpress API paths pay with the dropshipping account's own payment method: the amount is in the order read
 *      `aliexpress.trade.ds.order.get` (`order_amount`), which the code already calls (tracking, cancellation).
 *
 * Nothing here records anything: it compares. Recording real amounts on the order is a money-path change (owner decision).
 */

export type FeeComparison = { estimateCents: number; actualCents: number }

/** The real fee of a charge from its balance transaction; null unless it is settled in EUR (never convert silently). */
export function stripeFeeFromBalanceTransaction(bt: unknown): number | null {
  if (!bt || typeof bt !== "object") return null
  const o = bt as { fee?: unknown; currency?: unknown }
  if (typeof o.fee !== "number" || !Number.isInteger(o.fee) || o.fee < 0) return null
  return o.currency === "eur" ? o.fee : null
}

/** Split one charge's fee over its orders, pro rata of their charged totals; the parts add up to `feeCents`. */
export function allocateChargeFee(feeCents: number, orders: Array<{ id: string; chargedCents: number }>): Map<string, number> {
  const out = new Map<string, number>()
  const total = orders.reduce((a, o) => a + Math.max(0, o.chargedCents), 0)
  if (orders.length === 0) return out
  if (total <= 0) {
    orders.forEach((o, i) => out.set(o.id, i === 0 ? feeCents : 0))
    return out
  }
  const exact = orders.map((o) => (feeCents * Math.max(0, o.chargedCents)) / total)
  const floors = exact.map(Math.floor)
  let rest = feeCents - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => ({ i, frac: x - floors[i]! })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (rest <= 0) break
    floors[i]! += 1
    rest -= 1
  }
  orders.forEach((o, i) => out.set(o.id, floors[i]!))
  return out
}

/**
 * What an Issuing card really paid: captures are negative `amount`s, refunds positive; only EUR transactions count.
 * Returns null when the card has no transaction (nothing captured yet) or a non-EUR one (can not be compared).
 */
export function issuingNetDebitCents(transactions: Array<{ amount?: unknown; currency?: unknown; type?: unknown }>): number | null {
  if (transactions.length === 0) return null
  let net = 0
  for (const t of transactions) {
    if (t.currency !== "eur" || typeof t.amount !== "number" || !Number.isInteger(t.amount)) return null
    if (t.type !== "capture" && t.type !== "refund") continue
    net += -t.amount
  }
  return net
}

/**
 * The amount of an AliExpress order from `aliexpress.trade.ds.order.get`, in cents, EUR only (same rule as
 * `aliexpress-price-eur.ts`: a foreign amount is never read as euros). Accepts the documented shapes
 * `order_amount: { amount, currency_code }` with a decimal string or number.
 */
export function aeOrderAmountCents(payload: unknown): number | null {
  const root = payload as Record<string, unknown> | null
  const resp = (root?.["aliexpress_trade_ds_order_get_response"] ?? root) as Record<string, unknown> | undefined
  const result = (resp?.["result"] ?? resp) as Record<string, unknown> | undefined
  const amt = result?.["order_amount"] as { amount?: unknown; currency_code?: unknown } | undefined
  if (!amt || String(amt.currency_code ?? "").toUpperCase() !== "EUR") return null
  const n = typeof amt.amount === "number" ? amt.amount : typeof amt.amount === "string" && /^\d+(\.\d{1,2})?$/.test(amt.amount.trim()) ? Number(amt.amount) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

export type GapSummary = {
  n: number
  meanGapCents: number
  meanAbsGapCents: number
  p90AbsGapCents: number
  withinTenCents: number
  /** Real − estimate as a share of the estimate, over all rows (null when the estimates add up to 0). */
  relativeGap: number | null
}

/** How far the estimates are from the real amounts (real − estimate). */
export function summarizeGaps(rows: FeeComparison[]): GapSummary | null {
  if (rows.length === 0) return null
  const gaps = rows.map((r) => r.actualCents - r.estimateCents)
  const abs = gaps.map(Math.abs).sort((a, b) => a - b)
  const est = rows.reduce((a, r) => a + r.estimateCents, 0)
  const act = rows.reduce((a, r) => a + r.actualCents, 0)
  return {
    n: rows.length,
    meanGapCents: gaps.reduce((a, b) => a + b, 0) / rows.length,
    meanAbsGapCents: abs.reduce((a, b) => a + b, 0) / rows.length,
    p90AbsGapCents: abs[Math.min(abs.length - 1, Math.ceil(0.9 * abs.length) - 1)]!,
    withinTenCents: abs.filter((g) => g <= 10).length,
    relativeGap: est > 0 ? (act - est) / est : null,
  }
}
