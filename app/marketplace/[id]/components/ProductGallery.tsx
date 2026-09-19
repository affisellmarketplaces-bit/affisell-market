"use client"

import { ProductHighlightChips } from "@/components/product/product-highlight-chips"
import { ProductMediaGallery } from "@/components/product/product-media-gallery"
import { ProductOfferBadge } from "@/components/product/product-offer-badge"
import { WishlistHeart } from "@/components/wishlist-heart"
import type { ProductHighlight } from "@/lib/product-highlights"
import type { OfferModeBadge } from "@/lib/product-offer-mode"

type Props = {
  images: string[]
  heroSrc: string
  activeThumbIndex: number
  onSelectImage: (index: number) => void
  videoUrl?: string | null
  productId: string
  alt: string
  offerBadge?: OfferModeBadge | null
  has3D?: boolean
  view360Label: string
  /** Key benefits, shown in a row UNDER the photo. */
  highlights?: ProductHighlight[]
  highlightsAriaLabel?: string
}

/**
 * Photo rule: nothing written ever sits on the product photo. Offer / 3D badges and the like-heart live in a band
 * above the photo, key benefits in a row below it.
 */
export function ProductGallery({
  images,
  heroSrc,
  activeThumbIndex,
  onSelectImage,
  videoUrl,
  productId,
  alt,
  offerBadge,
  has3D,
  view360Label,
  highlights = [],
  highlightsAriaLabel,
}: Props) {
  const hasTextBadges = Boolean(offerBadge) || Boolean(has3D)

  return (
    <div className="relative max-lg:overflow-hidden max-lg:rounded-xl lg:overflow-visible">
      <ProductMediaGallery
        images={images}
        heroSrc={heroSrc}
        activeThumbIndex={activeThumbIndex}
        onSelectImage={onSelectImage}
        videoUrl={videoUrl}
        productId={productId}
        alt={alt}
        // Desktop shows the band only when there is a text badge; on mobile it also carries the like-heart.
        badgesClassName={hasTextBadges ? undefined : "lg:hidden"}
        badges={
          <>
            {offerBadge ? <ProductOfferBadge badge={offerBadge} variant="inline" /> : null}
            {has3D ? (
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                {view360Label}
              </span>
            ) : null}
            <span className="ml-auto rounded-full bg-white/95 p-1 shadow-md ring-1 ring-black/5 dark:bg-zinc-950/90 dark:ring-white/10 lg:hidden">
              <WishlistHeart productId={productId} />
            </span>
          </>
        }
        below={
          highlights.length > 0 ? (
            <ProductHighlightChips
              highlights={highlights}
             
              ariaLabel={highlightsAriaLabel}
              className="px-1 pt-1 lg:flex-wrap lg:overflow-visible"
            />
          ) : null
        }
      />
    </div>
  )
}
