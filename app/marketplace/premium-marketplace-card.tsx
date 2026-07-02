"use client"

import { FastLink } from "@/components/navigation/fast-link"

import { ProductDiscountTag } from "@/components/product-discount-tag"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { WishlistHeart } from "@/components/wishlist-heart"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { resolveProductDiscount } from "@/lib/product-discount-display"

type Props = {
  detailHref: string
  listingId: string
  productId: string
  imageUrl: string | null
  name: string
  sellerDisplay: string
  priceDisplay: string
  priceValue: number
  compareAt?: number | null
  showPremiumBadge?: boolean
}

export function PremiumMarketplaceCard({
  detailHref,
  listingId,
  productId,
  imageUrl,
  name,
  sellerDisplay,
  priceDisplay,
  priceValue,
  compareAt,
  showPremiumBadge = false,
}: Props) {
  const discountOffer = resolveProductDiscount(priceValue, compareAt)
  const hasDiscount = discountOffer != null

  return (
    <FastLink
      href={detailHref}
      className="group flex h-full w-full flex-col rounded-3xl border border-gray-100/90 bg-white/85 p-2 shadow-sm backdrop-blur-sm transition-shadow hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/5 dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-violet-800/50"
    >
      <div className="relative mb-3 aspect-square w-full shrink-0 overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-violet-50/40 to-teal-50/25 dark:border-zinc-800/80 dark:from-violet-950/25 dark:to-teal-950/15">
        {hasDiscount ? <ProductDiscountTag percent={discountOffer.percent} /> : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">Image</div>
        )}

        <WishlistHeart productId={productId} className="absolute right-3 top-3 z-20" />
        {showPremiumBadge ? (
          <span
            className="absolute bottom-2 left-2 z-[19] rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow"
          >
            Premium
          </span>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void addToBuyerCart({
              productId: listingId,
              qty: 1,
              title: name,
              price: priceValue,
              imageUrl: imageUrl || "/placeholder.png",
              sellerName: sellerDisplay,
            })
          }}
          className="absolute bottom-2 left-2 right-2 z-20 rounded-xl bg-white py-2.5 text-sm font-medium text-black opacity-0 shadow-lg transition-opacity hover:bg-zinc-100 group-hover:opacity-100"
        >
          Quick add
        </button>
      </div>

      <div className="flex flex-1 flex-col pb-1 pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-h-0 min-w-0 flex-1">
            <h3 className="line-clamp-3 h-[4.125rem] break-words font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
              {name}
            </h3>
          </div>
          <div className="shrink-0 pt-0.5 text-right">
            <ProductPriceOffer price={priceValue} compareAt={compareAt} layout="compact" align="end" />
          </div>
        </div>
        <p className="mt-1 line-clamp-2 h-10 text-sm leading-5 text-zinc-500 dark:text-zinc-400">by {sellerDisplay}</p>
      </div>
    </FastLink>
  )
}
