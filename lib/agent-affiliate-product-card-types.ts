/** Cartes produit pour l'agent sourcing affilié (catalogue fournisseur). */
export type AffiliateAgentProductCard = {
  id: string
  name: string
  imageUrl: string | null
  description: string
  supplierLabel: string
  basePriceCents: number
  commissionRate: number
  marginCents: number
  isInStore: boolean
  listingId: string | null
}

export type AffiliateAgentSearchToolResult = {
  products: AffiliateAgentProductCard[]
  similarProducts: AffiliateAgentProductCard[]
  suggestedCategories: string[]
}
