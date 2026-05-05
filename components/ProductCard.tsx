"use client"

import Link from "next/link"
import type { MouseEvent } from "react"

import { addGuestCartItem } from "@/lib/guest-cart"

export type ProductCardBadge = "bestseller" | "choice"

export type ProductCardProps = {
  /** Marketplace listing id for cart API */
  listingId: string
  href: string
  imageUrl: string | null
  title: string
  /** Price in EUR (e.g. 172.5) */
  price: number
  /** Optional strikethrough original price in EUR */
  originalPrice?: number
  rating?: number
  reviewCount?: number
  sellerName: string
  /** Amazon-style top-left badge (top 3 only) */
  amazonBadge?: ProductCardBadge
  /** Show Prime line instead of free delivery tomorrow */
  isPrime?: boolean
  /** When true and not Prime: "Livraison GRATUITE demain" */
  freeDeliveryTomorrow?: boolean
}

function formatEur(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  const full = Math.min(5, Math.max(0, Math.floor(rating + 1e-6)))
  const empty = 5 - full
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="leading-none tracking-tighter" aria-hidden>
        <span style={{ color: "#ff9900" }}>{"★".repeat(full)}</span>
        <span className="text-gray-300">{"★".repeat(empty)}</span>
      </span>
      <span className="font-medium text-gray-900">{rating.toFixed(1)}</span>
      <span className="text-gray-500">({count})</span>
    </div>
  )
}

export function ProductCard({
  listingId,
  href,
  imageUrl,
  title,
  price,
  originalPrice,
  rating = 4.5,
  reviewCount = 124,
  sellerName,
  amazonBadge,
  isPrime,
  freeDeliveryTomorrow = true,
}: ProductCardProps) {
  const img = imageUrl || "/placeholder.png"

  function handleAddToCart(e: MouseEvent) {
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
          title,
          price,
          imageUrl: img,
          sellerName,
        })
      }
    })
  }

  const badgeLabel = amazonBadge === "bestseller" ? "Meilleure vente" : amazonBadge === "choice" ? "Choix Amazon" : null

  return (
    <article className="flex h-full flex-col rounded-lg border border-[#e5e7eb] bg-white transition-shadow hover:border-gray-400 hover:shadow-md">
      <Link href={href} className="flex min-h-0 flex-1 flex-col">
        <div className="relative aspect-square w-full shrink-0 bg-[#ffffff] p-4">
          {badgeLabel ? (
            <span className="absolute left-4 top-4 z-10 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
              {badgeLabel}
            </span>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png"
            }}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2 pt-0.5">
          <h3 className="line-clamp-2 text-left text-sm font-medium text-gray-900 hover:underline">{title}</h3>

          <StarRow rating={rating} count={reviewCount} />

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-left text-lg font-bold text-gray-900">{formatEur(price)}</span>
            {originalPrice != null && originalPrice > price ? (
              <span className="text-sm text-gray-500 line-through">{formatEur(originalPrice)}</span>
            ) : null}
          </div>

          {isPrime ? (
            <span className="inline-flex w-fit rounded-sm bg-[#246bb3] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Prime
            </span>
          ) : freeDeliveryTomorrow ? (
            <p className="text-xs text-gray-600">Livraison GRATUITE demain</p>
          ) : (
            <p className="text-xs text-gray-600">Livraison suivie</p>
          )}

          <p className="text-xs text-gray-500">
            Vendu par <span className="text-gray-600">{sellerName}</span>
          </p>
        </div>
      </Link>

      <div className="mt-auto px-2 pb-2">
        <button
          type="button"
          onClick={handleAddToCart}
          className="w-full rounded-full bg-[#ffd814] py-2 text-sm font-medium text-black transition-colors hover:bg-[#f7ca00]"
        >
          Ajouter au panier
        </button>
      </div>
    </article>
  )
}
