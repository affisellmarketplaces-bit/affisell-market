"use client"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

export function CustomerMarketplaceView() {
  return (
    <MarketplaceView basePath={PUBLIC_MARKETPLACE_BROWSE_PATH} audience="customer" />
  )
}
