"use client"

import Image from "next/image"
import Link from "next/link"

import { addGuestCartItem } from "@/lib/guest-cart"

type Props = {
  detailHref: string
  imageUrl: string | null
  name: string
  priceDisplay: string
  sellerDisplay: string
  /** When false, hides the “by {seller}” line (shop / customer PDP). */
  showSellerAttribution?: boolean
  /** Shown between title and price on affiliate storefront grids */
  soldByAffiliate?: string | null
  /** When true POST /click before navigation (ignored if falsy listing id below) */
  trackClicks?: boolean
  /** Listing id (`AffiliateProduct.id`) — sent as `productId` to cart and checkout APIs. */
  product: { id: string }
  /** When product `deliveryMax` is 3 days or less */
  fastShipping?: boolean
  /** Short label e.g. "5% cashback" from affiliate listing */
  buyerRewardBadge?: string | null
}

export function MarketplaceListingCard({
  detailHref,
  imageUrl,
  name,
  priceDisplay,
  sellerDisplay,
  showSellerAttribution = true,
  soldByAffiliate,
  trackClicks,
  product,
  fastShipping,
  buyerRewardBadge,
}: Props) {
  const listing = {
    id: product.id,
    image: imageUrl || "/placeholder.png",
    title: name,
  }

  async function addToCart(listingId: string) {
    const res = await fetch("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: listingId, qty: 1 }),
      credentials: "include",
    })
    if (res.status === 401) {
      addGuestCartItem({
        productId: listingId,
        qty: 1,
        title: name,
        imageUrl: listing.image,
        sellerName: sellerDisplay,
      })
      return
    }
  }

  function recordClick() {
    if (!trackClicks || !product.id) return
    void fetch(`/api/affiliate/products/${product.id}/click`, { method: "POST", keepalive: true })
  }

  async function buyNow(listingId: string) {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: listingId, qty: 1 }),
      credentials: "include",
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="group flex h-full w-full flex-col overflow-hidden rounded-3xl border border-gray-100/90 bg-white/90 shadow-sm backdrop-blur-sm transition hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/5 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-violet-800/50">
      <Link href={detailHref} className="block" onPointerDown={() => recordClick()}>
        <div className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-t-2xl border-b border-gray-100/80 bg-gradient-to-br from-violet-50/35 to-teal-50/20 p-4 dark:border-zinc-800 dark:from-violet-950/20 dark:to-teal-950/10">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            unoptimized
            className="object-contain p-4"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png"
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void addToCart(listing.id)
            }}
            className="absolute bottom-2 left-2 right-2 z-10 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity hover:bg-violet-700 group-hover:opacity-100"
          >
            Add to cart
          </button>
        </div>
        <div className="p-4">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-3 h-[4.125rem] break-words font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
              {name}
            </h3>
          </div>
          {fastShipping ? (
            <p className="mt-1.5">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Fast Shipping
              </span>
            </p>
          ) : null}
          {soldByAffiliate ? (
            <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Sold by {soldByAffiliate}</p>
          ) : null}
          <p
            className={`mt-2 text-lg font-medium ${soldByAffiliate ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}
          >
            {priceDisplay}
          </p>
          {buyerRewardBadge ? (
            <p className="mt-1.5">
              <span className="inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900 dark:bg-teal-950/80 dark:text-teal-100">
                {buyerRewardBadge}
              </span>
            </p>
          ) : null}
          {showSellerAttribution ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              by <span className="font-medium text-zinc-700 dark:text-zinc-300">{sellerDisplay}</span>
            </p>
          ) : null}
        </div>
      </Link>
      <div className="px-4 pb-4">
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void addToCart(listing.id)}
            className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800"
          >
            Add to cart
          </button>
          <button
            type="button"
            onClick={() => void buyNow(listing.id)}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  )
}
