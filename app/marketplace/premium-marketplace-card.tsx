"use client"

import Link from "next/link"

import { addGuestCartItem } from "@/lib/guest-cart"
import { WishlistHeart } from "@/components/wishlist-heart"

type Props = {
  detailHref: string
  listingId: string
  productId: string
  imageUrl: string | null
  name: string
  sellerDisplay: string
  priceDisplay: string
  priceValue: number
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
  showPremiumBadge = false,
}: Props) {
  return (
    <Link
      href={detailHref}
      className="group relative block rounded-2xl transition-shadow hover:shadow-xl hover:shadow-zinc-200/50"
    >
      <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">Image</div>
        )}

        <WishlistHeart productId={productId} className="absolute right-3 top-3 z-20" />
        {showPremiumBadge ? (
          <span className="absolute left-3 top-3 z-20 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
            Premium
          </span>
        ) : null}

        <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: listingId, qty: 1 }),
              }).then((r) => {
                if (r.status === 401) {
                  addGuestCartItem({
                    productId: listingId,
                    qty: 1,
                    title: name,
                    price: priceValue,
                    imageUrl: imageUrl || "/placeholder.png",
                    sellerName: sellerDisplay,
                  })
                }
              })
            }}
            className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black shadow-lg transition hover:bg-zinc-100"
          >
            Ajout rapide
          </button>
        </div>
      </div>

      <div className="min-h-[8rem] pb-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-3 min-h-[4.125rem] break-words font-semibold leading-snug text-zinc-900">{name}</h3>
          </div>
          <span className="shrink-0 pt-0.5 font-medium text-zinc-900">{priceDisplay}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-500">by {sellerDisplay}</p>
      </div>
    </Link>
  )
}
