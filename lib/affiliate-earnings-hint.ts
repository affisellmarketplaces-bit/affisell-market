/** Default illustrative retail uplift vs supplier catalog anchor shown to affiliates (%). */
export const ILLUSTRATIVE_RETAIL_MARKUP_PCT = 18

/**
 * Illustrative partner share per sold unit when the affiliate sells at (1 + markup) × supplier base price.
 * Commission is modeled as `% of margin` where margin = retail − supplier base (see supplier listing copy).
 */
export function illustrativePartnerShareUsd(args: {
  basePriceCents: number
  commissionRatePct: number
  /** Retail uplift vs catalog anchor (default {@link ILLUSTRATIVE_RETAIL_MARKUP_PCT}). */
  retailMarkupPct?: number
}): {
  retailUsd: number
  marginUsd: number
  partnerShareUsd: number
  retailMarkupPct: number
} | null {
  const { basePriceCents, commissionRatePct, retailMarkupPct = ILLUSTRATIVE_RETAIL_MARKUP_PCT } = args
  if (!Number.isFinite(commissionRatePct) || commissionRatePct <= 0) return null
  const baseUsd = basePriceCents / 100
  if (!(baseUsd > 0)) return null
  const retailUsd = Math.round(baseUsd * (1 + retailMarkupPct / 100) * 100) / 100
  const marginUsd = Math.round((retailUsd - baseUsd) * 100) / 100
  if (!(marginUsd > 0)) return null
  const partnerShareUsd = Math.round(marginUsd * (commissionRatePct / 100) * 100) / 100
  return {
    retailUsd,
    marginUsd,
    partnerShareUsd,
    retailMarkupPct,
  }
}
