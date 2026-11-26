/**
 * Net-margin guard for what Affisell RECOMMENDS to a reseller (opportunity rail, swipe feed, AI agent search).
 *
 * The reseller's real earnings per sale are the NET (commission + markup − Affisell's reseller fee, see
 * `buildAffiliateCatalogCardEconomics`), and a refunded order claws that amount back (`lib/affiliate-clawback-risk.ts`).
 * Shipping is included in the supplier's price (buyers are never charged shipping), Stripe fees are borne by Affisell,
 * and the supplier pays returns — so the reseller's cost of a refund is the lost net. The guard therefore works on
 *
 *     expected net per sale = net × (1 − expected refund rate) − other per-sale costs the reseller declares
 *
 * and refuses to RECOMMEND a product whose expected net is too small in euros or relative to the client price.
 * It never blocks a reseller from listing a product, and every figure it returns is an ESTIMATE (`estimated: true`):
 * the refund rate is an assumption until per-product rates are measured (event journal, step S2+).
 */
export const DEFAULT_EXPECTED_REFUND_RATE = 0.1
/** Below this expected net per sale, a product is not recommended. */
export const MIN_EXPECTED_NET_CENTS = 200
/** Below this share of the client price, a product is not recommended. */
export const MIN_EXPECTED_NET_RATE = 0.05
/** Recommended, but flagged as thin, below these. */
export const THIN_EXPECTED_NET_CENTS = 500
export const THIN_EXPECTED_NET_RATE = 0.1

export type MarginGuardLevel = "healthy" | "thin" | "insufficient"
export type MarginGuardReason = "net_too_small" | "net_rate_too_low" | "thin_net" | "thin_rate"

export type MarginGuardInput = {
  /** Net per sale after Affisell's fee (`economics.netPartnerGainCents`). */
  netGainCents: number
  /** Price the buyer pays (HT) — the base of the margin rate. */
  clientPriceCents: number
  /** Expected share of sales refunded (0–1). Defaults to {@link DEFAULT_EXPECTED_REFUND_RATE}. */
  expectedRefundRate?: number | null
  /** Other per-sale costs the reseller bears (ads, packaging inserts…), declared by them. */
  otherCostCents?: number | null
}

export type MarginGuardVerdict = {
  level: MarginGuardLevel
  reasons: MarginGuardReason[]
  /** Expected net per sale after refunds and declared costs (may be negative). */
  expectedNetCents: number
  /** expectedNetCents / clientPriceCents. */
  expectedNetRate: number
  expectedRefundRate: number
  /** Always true: an estimate, never a guaranteed margin. */
  estimated: true
}

const finite = (n: number | null | undefined, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? n : fallback)

export function evaluateMarginGuard(input: MarginGuardInput): MarginGuardVerdict {
  const refundRate = Math.min(1, Math.max(0, finite(input.expectedRefundRate, DEFAULT_EXPECTED_REFUND_RATE)))
  const net = Math.max(0, Math.round(finite(input.netGainCents, 0)))
  const other = Math.max(0, Math.round(finite(input.otherCostCents, 0)))
  const price = Math.max(0, Math.round(finite(input.clientPriceCents, 0)))
  const expectedNetCents = Math.round(net * (1 - refundRate)) - other
  const expectedNetRate = price > 0 ? expectedNetCents / price : 0

  const reasons: MarginGuardReason[] = []
  if (expectedNetCents < MIN_EXPECTED_NET_CENTS) reasons.push("net_too_small")
  if (expectedNetRate < MIN_EXPECTED_NET_RATE) reasons.push("net_rate_too_low")
  let level: MarginGuardLevel = reasons.length > 0 ? "insufficient" : "healthy"
  if (level === "healthy") {
    if (expectedNetCents < THIN_EXPECTED_NET_CENTS) reasons.push("thin_net")
    if (expectedNetRate < THIN_EXPECTED_NET_RATE) reasons.push("thin_rate")
    if (reasons.length > 0) level = "thin"
  }
  return { level, reasons, expectedNetCents, expectedNetRate, expectedRefundRate: refundRate, estimated: true }
}

export function isRecommendable(verdict: MarginGuardVerdict): boolean {
  return verdict.level !== "insufficient"
}

/** Guard verdict straight from catalog economics (`buildAffiliateCatalogCardEconomics`). */
export function marginGuardForEconomics(
  economics: { netPartnerGainCents: number; clientPriceCents: number },
  options?: { expectedRefundRate?: number | null; otherCostCents?: number | null }
): MarginGuardVerdict {
  return evaluateMarginGuard({
    netGainCents: economics.netPartnerGainCents,
    clientPriceCents: economics.clientPriceCents,
    expectedRefundRate: options?.expectedRefundRate,
    otherCostCents: options?.otherCostCents,
  })
}

/** Recommendation order: recommendable first, then by expected net (desc). Stable for equal values. */
export function compareForRecommendation(a: MarginGuardVerdict, b: MarginGuardVerdict): number {
  const ra = isRecommendable(a) ? 0 : 1
  const rb = isRecommendable(b) ? 0 : 1
  if (ra !== rb) return ra - rb
  return b.expectedNetCents - a.expectedNetCents
}
