"use client"

import Image from "next/image"
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
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
      <Link href={detailHref} className="block">
        <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-800">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 33vw"
              unoptimized={imageUrl.startsWith("http")}
            />
          ) : null}
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
            onClick={async () => {
              const res = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id, qty: 1 }),
                credentials: "include",
              })
              console.log("Add to cart", res.ok ? "ok" : await res.text())
            }}
            className="flex-1 px-3 py-2 border rounded-lg text-sm hover:bg-zinc-50"
          >
            Add to cart
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id, qty: 1 }),
                credentials: "include",
              })
              const data = (await res.json()) as { url?: string; error?: string }
              if (data.url) window.location.href = data.url
            }}
            className="flex-1 px-3 py-2 bg-black text-white rounded-lg text-sm hover:opacity-90"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  )
}
