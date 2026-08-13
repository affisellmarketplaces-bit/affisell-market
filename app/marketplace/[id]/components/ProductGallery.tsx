"use client"

import { ProductMediaGallery } from "@/components/product/product-media-gallery"
import { ProductOfferBadge } from "@/components/product/product-offer-badge"
import { WishlistHeart } from "@/components/wishlist-heart"
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
}

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
}: Props) {
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
        overlay={
          <>
            {offerBadge ? <ProductOfferBadge badge={offerBadge} /> : null}
            {has3D ? (
              <span
                className={`pointer-events-none absolute left-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-md ${
                  offerBadge ? "top-10" : "top-4"
                }`}
              >
                {view360Label}
              </span>
            ) : null}
          </>
        }
      />
      <div className="absolute right-2 top-2 z-10 lg:hidden">
        <div className="rounded-full bg-white/95 p-1 shadow-md ring-1 ring-black/5 backdrop-blur-sm dark:bg-zinc-950/90 dark:ring-white/10">
          <WishlistHeart productId={productId} />
        </div>
      </div>
    </div>
  )
}
