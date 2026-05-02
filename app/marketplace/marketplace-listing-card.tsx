"use client"

import Link from "next/link"

type Props = {
  detailHref: string
  imageUrl: string | null
  name: string
  priceDisplay: string
  sellerDisplay: string
  /** Shown between title and price on affiliate storefront grids */
  soldByAffiliate?: string | null
  /** When true POST /click before navigation (ignored if falsy listing id below) */
  trackClicks?: boolean
  /** Listing id (`AffiliateProduct.id`) — sent as `productId` to cart and checkout APIs. */
  product: { id: string }
  /** When product `deliveryMax` is 3 days or less */
  fastShipping?: boolean
}

export function MarketplaceListingCard({
  detailHref,
  imageUrl,
  name,
  priceDisplay,
  sellerDisplay,
  soldByAffiliate,
  trackClicks,
  product,
  fastShipping,
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
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
      <Link href={detailHref} className="block" onPointerDown={() => recordClick()}>
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
          {fastShipping ? (
            <p className="mt-1.5">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Fast Shipping
              </span>
            </p>
          ) : null}
          {soldByAffiliate ? (
            <p className="mt-1 text-xs font-medium text-green-700">Sold by {soldByAffiliate}</p>
          ) : null}
          <p
            className={`mt-2 text-lg font-medium ${soldByAffiliate ? "text-green-600" : "text-zinc-900 dark:text-zinc-100"}`}
          >
            {priceDisplay}
          </p>
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
