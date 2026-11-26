/** Cartes produit pour l'agent sourcing affilié (catalogue fournisseur). */
export type AffiliateAgentProductCard = {
  id: string
  name: string
  imageUrl: string | null
  description: string
  supplierLabel: string
  basePriceCents: number
  commissionRate: number
  /**
   * ESTIMATED net the reseller keeps per sale (commission + markup − Affisell's reseller fee) — never a guaranteed
   * margin. Was the gross (before the fee) until 2026-11.
   */
  marginCents: number
  /** Commission + markup before Affisell's reseller fee. */
  grossGainCents?: number
  /** Net-margin guard (lib/reseller-margin-guard.ts): "insufficient" products are never recommended. */
  marginGuard?: "healthy" | "thin" | "insufficient"
  clientPriceCents: number
  usesListedPrice: boolean
  isInStore: boolean
  listingId: string | null
}

export type AffiliateAgentSearchToolResult = {
  products: AffiliateAgentProductCard[]
  similarProducts: AffiliateAgentProductCard[]
  suggestedCategories: string[]
}
