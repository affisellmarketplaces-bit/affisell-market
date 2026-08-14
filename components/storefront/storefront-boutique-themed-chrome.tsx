"use client"

import { ResellerBoutiqueThemeVars } from "@/components/boutique/reseller-boutique-theme-vars"
import { StorefrontBuyerChrome } from "@/components/storefront/storefront-buyer-chrome"
import { getStorefrontThemeById } from "@/lib/boutique/storefront-theme-engine"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"

type Props = {
  boutiqueThemeId: string
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  trustRailText?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  categoriesSlug?: string
  shopHomePath?: string
  trust?: StorefrontTrustSnapshot | null
  isCustomDomain?: boolean
}

/**
 * Buyer chrome on `/shops/` tinted by saved boutique procedural theme —
 * same seamless header skin as `/boutique/`, buyer menu + cart preserved.
 */
export function StorefrontBoutiqueThemedChrome({
  boutiqueThemeId,
  ...chrome
}: Props) {
  const theme = getStorefrontThemeById(boutiqueThemeId)

  return (
    <ResellerBoutiqueThemeVars theme={theme}>
      <StorefrontBuyerChrome {...chrome} boutiqueSeamless />
    </ResellerBoutiqueThemeVars>
  )
}
