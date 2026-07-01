"use client"

import { StorefrontBuyerChrome } from "@/components/storefront/storefront-buyer-chrome"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  trustRailText?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  categories?: StorefrontCategoryGroup[]
  categoriesSlug?: string
  totalProducts?: number
  shopHomePath?: string
  trust?: StorefrontTrustSnapshot | null
  isCustomDomain?: boolean
}

export function StorefrontBuyerChromeBar(props: Props) {
  return <StorefrontBuyerChrome {...props} />
}
