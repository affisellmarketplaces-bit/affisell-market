"use client"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"

/** Full buyer marketplace (rayons, catégories, grille) embedded on the public home. */
export function BuyerMarketplaceExplorer() {
  return <MarketplaceView basePath="/" audience="customer" embedded />
}
