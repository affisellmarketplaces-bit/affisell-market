/**
 * Client-safe catalog types + niche filters (no Prisma).
 * Server queries: `@/lib/affiliate-catalog-query`.
 */

export const AFFILIATE_CATALOG_NICHES = {
  fitness: ["fitness", "sport", "Fitness", "Sport", "Exercise", "gym"],
  tech: ["électronique", "electronique", "informatique", "tech", "Électronique", "Informatique", "Gaming"],
  maison: ["maison", "Maison", "déco", "décor", "mobilier", "cuisine", "home", "jardin"],
} as const

export type AffiliateCatalogNiche = keyof typeof AFFILIATE_CATALOG_NICHES

export type AffiliateCatalogColorImage = {
  color: string
  hex: string
  image: string
}

export type AffiliateCatalogProduct = {
  id: string
  name: string
  images: string[]
  categories: string[]
  colors: string[]
  colorImages: AffiliateCatalogColorImage[]
  tags: string[]
  basePriceCents: number
  commissionRate: number
  deliveryMax: number | null
  createdAt: string
  affiliateProducts: { id: string; isListed: boolean }[]
  supplier: {
    email: string
    store: { name: string; slug: string } | null
  }
}

export type AffiliateCatalogHighlightCard = {
  productId: string
  name: string
  imageUrl: string | null
  basePriceCents: number
  commissionRate: number
  marginCents: number
  soldCount: number
  isInStore: boolean
  listingId: string | null
  supplierLabel: string
}

export type AffiliateCatalogHighlights = {
  bestSellers7d: AffiliateCatalogHighlightCard[]
  newArrivals: AffiliateCatalogHighlightCard[]
  highMargin: AffiliateCatalogHighlightCard[]
}
