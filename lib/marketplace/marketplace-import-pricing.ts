/** Marketplace 1-clic import pricing — client-safe constants. */
export const MARKETPLACE_URL_IMPORT_SOURCE = "marketplace_url_import"
export const MARKETPLACE_IMPORT_MARKUP = 2.5
export const MARKETPLACE_IMPORT_MIN_EUR = 19.99

export function computeMarketplaceBaseSellingPriceEur(costEur: number): number {
  const raw = costEur * MARKETPLACE_IMPORT_MARKUP
  return Math.max(MARKETPLACE_IMPORT_MIN_EUR, parseFloat(raw.toFixed(2)))
}
