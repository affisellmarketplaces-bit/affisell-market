import { cache } from "react"

import { loadPdpCrossSellBundle } from "@/lib/load-marketplace-pdp-cross-sell"
import {
  mapPdpCrossSellListings,
  type PdpCrossSellCard,
} from "@/lib/marketplace-pdp-cross-sell-shared"

export type PdpCrossSellCards = {
  oftenBoughtTogether: PdpCrossSellCard[]
  alsoViewed: PdpCrossSellCard[]
}

export const loadPdpCrossSellCards = cache(
  async (args: {
    listingId: string
    productId: string
    affiliateId: string
    storeSlug?: string | null
    categories: string[]
  }): Promise<PdpCrossSellCards> => {
    try {
      const crossSell = await loadPdpCrossSellBundle({
        listingId: args.listingId,
        productId: args.productId,
        affiliateId: args.affiliateId,
        storeSlug: args.storeSlug?.trim() || null,
        categories: args.categories,
      })

      return {
        oftenBoughtTogether: mapPdpCrossSellListings(crossSell.boughtTogether, {
          storeSlug: args.storeSlug ?? undefined,
          limit: 4,
        }),
        alsoViewed: mapPdpCrossSellListings(crossSell.alsoViewed, {
          storeSlug: args.storeSlug ?? undefined,
          limit: 4,
        }),
      }
    } catch (e) {
      console.log("[pdp-cross-sell]", {
        result: "cards_failed",
        listingId: args.listingId,
        error: e instanceof Error ? e.message : String(e),
      })
      return { oftenBoughtTogether: [], alsoViewed: [] }
    }
  }
)
