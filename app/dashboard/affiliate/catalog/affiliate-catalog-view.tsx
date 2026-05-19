"use client"

import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"

export function AffiliateCatalogView() {
  return <MarketplaceView basePath={AFFILIATE_CATALOG_PATH} audience="affiliate" />
}
