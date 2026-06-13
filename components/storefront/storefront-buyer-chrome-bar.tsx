"use client"

import { StorefrontBuyerChrome } from "@/components/storefront/storefront-buyer-chrome"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  categories: StorefrontCategoryGroup[]
  totalProducts: number
}

export function StorefrontBuyerChromeBar(props: Props) {
  return <StorefrontBuyerChrome {...props} />
}
