"use client"

import { Suspense } from "react"

import { StorefrontBuyerChrome } from "@/components/storefront/storefront-buyer-chrome"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  categories: StorefrontCategoryGroup[]
  totalProducts: number
}

function StorefrontBuyerChromeInner(props: Props) {
  return <StorefrontBuyerChrome {...props} />
}

export function StorefrontBuyerChromeBar(props: Props) {
  return (
    <Suspense fallback={null}>
      <StorefrontBuyerChromeInner {...props} />
    </Suspense>
  )
}
