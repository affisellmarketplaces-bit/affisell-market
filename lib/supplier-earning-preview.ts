/**
 * What a supplier actually receives per sale — shown BEFORE publishing. Pure and client-safe.
 *
 * Mirrors the settlement (`lib/marketplace-order-settlement.ts` + `lib/marketplace-supplier-fee.ts`), cent for cent:
 *
 *     commission = round(price × commission%)        — paid to the reseller OUT OF the supplier's price
 *     fee        = round(price × feeBps / 10 000)    — Affisell's commission on the supplier side (category rate, or the
 *                                                       supplier's negotiated override)
 *     you get    = price − commission − fee
 *
 * A test compares this module with the real settlement functions over a grid of prices and rates, so it cannot drift.
 * (Catalogue channel only: the auto-buy channel adds a surcharge and bases the fee on the AliExpress wholesale.)
 */
export type EarningPreviewInput = {
  /** The supplier's catalogue price (HT), in euros. */
  priceEur: number
  /** Commission offered to resellers, whole percent of the price. */
  commissionPct: number
  /** Affisell's supplier-side rate in basis points, or null while it is unknown (no category chosen yet). */
  feeBps: number | null
}

export type EarningPreview = {
  priceCents: number
  commissionCents: number
  /** null while the rate is unknown. */
  feeCents: number | null
  /** What the supplier receives; before Affisell's fee when `feeCents` is null. */
  netCents: number
  feeKnown: boolean
}

const MAX_BPS = 5000

export function computeEarningPreview(input: EarningPreviewInput): EarningPreview {
  const priceCents = Number.isFinite(input.priceEur) && input.priceEur > 0 ? Math.round(input.priceEur * 100) : 0
  const commissionBps = Math.round(Math.min(100, Math.max(0, Number.isFinite(input.commissionPct) ? input.commissionPct : 0)) * 100)
  const commissionCents = Math.round((priceCents * commissionBps) / 10_000)

  const feeKnown = input.feeBps != null && Number.isFinite(input.feeBps)
  const feeBps = feeKnown ? Math.min(MAX_BPS, Math.max(0, Math.round(input.feeBps as number))) : 0
  const feeCents = feeKnown ? Math.round((priceCents * feeBps) / 10_000) : null

  return {
    priceCents,
    commissionCents,
    feeCents,
    netCents: Math.max(0, priceCents - commissionCents - (feeCents ?? 0)),
    feeKnown,
  }
}
