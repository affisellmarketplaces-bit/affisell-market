/** Reseller boutique variant summaries — client-safe (no Prisma). */

export type ResellerListingVariantSummary = {
  /** Distinct purchasable combinations (colors × sizes × storage). */
  optionCount: number
  colorNames: string[]
  sizeCount: number
  storageCount: number
  hasMultipleOptions: boolean
  /** Lowest affiliate selling price among in-stock options. */
  priceFromCents: number
  /** Highest affiliate selling price among in-stock options. */
  priceToCents: number
}

export function formatResellerPriceFromLabel(
  summary: ResellerListingVariantSummary,
  formatCents: (cents: number) => string
): string | null {
  if (!summary.hasMultipleOptions || summary.priceFromCents === summary.priceToCents) {
    return null
  }
  return `À partir de ${formatCents(summary.priceFromCents)}`
}

export function formatResellerVariantOptionsLabel(summary: ResellerListingVariantSummary): string | null {
  if (!summary.hasMultipleOptions) return null
  const parts: string[] = []
  if (summary.colorNames.length > 1) {
    parts.push(`${summary.colorNames.length} couleurs`)
  }
  if (summary.sizeCount > 1) {
    parts.push(`${summary.sizeCount} tailles`)
  }
  if (summary.storageCount > 1) {
    parts.push(`${summary.storageCount} options`)
  }
  if (parts.length === 0 && summary.optionCount > 1) {
    return `${summary.optionCount} options`
  }
  return parts.length > 0 ? parts.join(" · ") : null
}
