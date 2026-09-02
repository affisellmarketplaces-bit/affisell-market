import type { CatalogAffiliateListingRow } from "@/lib/affiliate-catalog-listing-state"
import { suggestedSellingPriceCents } from "@/lib/affiliate-catalog-margin-display"

export type QuickAddCatalogProduct = {
  id: string
  basePriceCents: number
  affiliateProducts?: CatalogAffiliateListingRow[]
}

export function optimisticAffiliateListingRow(
  product: QuickAddCatalogProduct,
  listingId: string
): CatalogAffiliateListingRow {
  return {
    id: listingId,
    isListed: false,
    sellingPriceCents: suggestedSellingPriceCents(product.basePriceCents),
    clicks: 0,
    conversions: 0,
  }
}

export function patchCatalogProductListing<T extends QuickAddCatalogProduct>(
  products: T[],
  productId: string,
  listing: CatalogAffiliateListingRow | null
): T[] {
  return products.map((p) =>
    p.id === productId ? { ...p, affiliateProducts: listing ? [listing] : [] } : p
  )
}

export async function requestQuickAddAffiliateListing(productId: string): Promise<{
  id: string
  sellingPriceCents: number
  created: boolean
}> {
  const res = await fetch("/api/affiliate/products/quick-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId }),
  })
  const data = (await res.json()) as {
    error?: string
    id?: string
    sellingPriceCents?: number
    created?: boolean
  }
  if (!res.ok || !data.id || typeof data.sellingPriceCents !== "number") {
    throw new Error(data.error ?? "Quick add failed")
  }
  return {
    id: data.id,
    sellingPriceCents: data.sellingPriceCents,
    created: data.created === true,
  }
}
