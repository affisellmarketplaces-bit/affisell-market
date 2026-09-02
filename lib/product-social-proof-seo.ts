import {
  shouldShowProductCrossSocialProof,
  type ProductSocialProofData,
} from "@/lib/product-social-proof-shared"

/** SEO parasite — crawlable reseller activity on Product JSON-LD. */
export function appendCrossSocialProofJsonLd(
  productJsonLd: Record<string, unknown>,
  data: ProductSocialProofData | null | undefined
): Record<string, unknown> {
  if (!data || !shouldShowProductCrossSocialProof(data)) return productJsonLd

  const stats: Record<string, unknown>[] = [
    {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/SellAction",
      userInteractionCount: data.activeResellersCount,
      description: "Active Affisell resellers in the last 30 days",
    },
  ]

  if (data.topMarginCents > 0) {
    stats.push({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/TradeAction",
      description: "Top partner margin on this SKU (EUR cents snapshot)",
      userInteractionCount: data.topMarginCents,
    })
  }

  return {
    ...productJsonLd,
    interactionStatistic: stats,
  }
}
