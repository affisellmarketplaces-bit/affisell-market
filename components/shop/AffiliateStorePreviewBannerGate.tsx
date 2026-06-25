"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

import { AffiliateStorePreviewBanner } from "@/components/shop/AffiliateStorePreviewBanner"
import {
  isAffiliateOwnerPreviewUrl,
  isAffiliateStoreOwner,
  shouldShowAffiliateStorePreviewBanner,
} from "@/lib/affiliate-store-preview-access"

type Props = {
  storeSlug: string
  storeUserId: string
}

function AffiliateStorePreviewBannerGateInner({ storeSlug, storeUserId }: Props) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const isStoreOwner = isAffiliateStoreOwner(session?.user?.id, storeUserId)
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
