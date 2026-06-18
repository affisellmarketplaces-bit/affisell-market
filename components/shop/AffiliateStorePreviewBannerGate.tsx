"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { AffiliateStorePreviewBanner } from "@/components/shop/AffiliateStorePreviewBanner"
import {
  isAffiliateOwnerPreviewUrl,
  shouldShowAffiliateStorePreviewBanner,
} from "@/lib/affiliate-store-preview-access"

type Props = {
  storeSlug: string
  isStoreOwner: boolean
}

function AffiliateStorePreviewBannerGateInner({ storeSlug, isStoreOwner }: Props) {
  const searchParams = useSearchParams()
  if (
    !shouldShowAffiliateStorePreviewBanner(
      isStoreOwner,
      isAffiliateOwnerPreviewUrl(searchParams)
    )
  ) {
    return null
  }
  return <AffiliateStorePreviewBanner storeSlug={storeSlug} />
}

/** Renders owner preview chrome only for the store holder in explicit preview mode. */
export function AffiliateStorePreviewBannerGate(props: Props) {
  return (
    <Suspense fallback={null}>
      <AffiliateStorePreviewBannerGateInner {...props} />
    </Suspense>
  )
}
