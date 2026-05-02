"use client"

import Link from "next/link"

type Props = {
  detailHref: string
  imageUrl: string | null
  name: string
  priceDisplay: string
  sellerDisplay: string
  /** Listing id (`AffiliateProduct.id`) — sent as `productId` to cart and checkout APIs. */
  product: { id: string }
}

export function MarketplaceListingCard({
  detailHref,
  imageUrl,
  name,
  priceDisplay,
  sellerDisplay,
  product,
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
    console.log("Add to cart", res.ok ? "ok" : await res.text())
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
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
      <Link href={detailHref} className="block">
        <div className="aspect-[4/3] bg-gray-50 rounded-t-xl overflow-hidden flex items-center justify-center p-3">
          <img
            src={listing.image}
            alt={listing.title}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png"
            }}
          />
        </div>
        <div className="p-4">
          <p className="font-semibold leading-snug">{name}</p>
          <p className="mt-2 text-lg font-medium">{priceDisplay}</p>
          <p className="mt-1 text-xs text-zinc-500">
            by <span className="font-medium text-zinc-700 dark:text-zinc-300">{sellerDisplay}</span>
          </p>
        </div>
      </Link>
      <div className="px-4 pb-4">
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => void addToCart(listing.id)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl px-4 py-2.5 transition-colors shadow-sm"
          >
            Add to cart
          </button>
          <button
            type="button"
            onClick={() => void buyNow(listing.id)}
            className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium rounded-xl px-4 py-2.5 transition-colors shadow-sm"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  )
}
