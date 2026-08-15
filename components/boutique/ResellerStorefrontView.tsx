"use client"

import type { ReactNode } from "react"

import { ResellerStorefrontGrid } from "@/components/boutique/ResellerStorefrontGrid"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { BrandStudioSnapshot } from "@/lib/boutique/haute-gamme-themes-shared"
import type { BoutiqueTitleTypography } from "@/lib/boutique/boutique-title-typography-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import type { StorefrontTheme } from "@/lib/boutique/storefront-themes"

type Props = {
  storeSlug: string
  storeLabel: string
  tagline?: string | null
  brandTheme: ResellerBoutiqueThemeProps
  initialVisualTheme: StorefrontTheme
  persistedVisualTheme: StorefrontTheme
  titleTypography: BoutiqueTitleTypography
  persistedTitleTypography: BoutiqueTitleTypography
  productCardTrustLine: string
  products: ResellerStorefrontListProduct[]
  count: number
  header?: ReactNode
  viewerIsOwner?: boolean
  brandStudio?: BrandStudioSnapshot | null
}

export function ResellerStorefrontView(props: Props) {
  return <ResellerStorefrontGrid {...props} />
}
