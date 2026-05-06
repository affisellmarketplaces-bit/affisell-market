"use client"

import { Heart } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ProductCardProduct = {
  title?: string
  name?: string
  image?: string
  images?: string[]
  price: number | string
  compareAt?: number | string | null
  store?: string | null
  isBestSeller?: boolean
}

type ProductCardProps = {
  product: ProductCardProduct | Record<string, unknown>
}

function coerceProduct(p: ProductCardProps["product"]): {
  title: string
  image: string
  price: number
  compareAt: number | null
  store: string | null
  isBestSeller: boolean
} {
  const o = p as Record<string, unknown>
  const title = String(o.title ?? o.name ?? "")
  const images = o.images
  const imageFromArr = Array.isArray(images) && typeof images[0] === "string" ? images[0] : ""
  const image = String(o.image ?? imageFromArr ?? "").trim()
  const priceRaw = o.price ?? o.basePriceUsd
  let price = Number(priceRaw)
  if (!Number.isFinite(price) && typeof o.basePriceCents === "number") {
    price = o.basePriceCents / 100
  }
  if (!Number.isFinite(price)) price = 0
  const c = o.compareAt
  const compareAt =
    c != null && c !== "" && Number.isFinite(Number(c)) ? Number(c) : null
  const store = (o.store ?? null) as string | null
  const isBestSeller = Boolean(o.isBestSeller)
  return { title, image, price, compareAt, store, isBestSeller }
}

export function ProductCard({ product }: ProductCardProps) {
  const p = coerceProduct(product)
  const priceN = p.price
  const compareN = p.compareAt
  const hasDiscount = compareN != null && compareN > priceN
  const discount = hasDiscount ? Math.round(((compareN - priceN) / compareN) * 100) : 0
  const src = p.image || "/placeholder-product.jpg"

  return (
    <div className="group">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-100 bg-[#F5F5F5]">
        {hasDiscount ? (
          <Badge className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-3 py-1.5 font-black text-white hover:bg-red-500">
            SAVE {discount}%
          </Badge>
        ) : null}
        {p.isBestSeller ? (
          <Badge
            className={cn(
              "absolute left-3 z-10 rounded-full bg-amber-500 px-3 py-1.5 font-black text-white hover:bg-amber-500",
              hasDiscount ? "top-12" : "top-3"
            )}
          >
            Best Seller
          </Badge>
        ) : null}
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-all hover:bg-white"
        >
          <Heart className="h-4 w-4 text-gray-700" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote URLs + placeholder */}
        <img
          src={src}
          alt={p.title}
          className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-product.jpg"
          }}
        />
      </div>

      <div className="mt-3 px-1">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-gray-900">{p.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-black text-gray-900">${priceN.toFixed(2)}</span>
          {hasDiscount ? (
            <span className="text-sm text-gray-400 line-through">${compareN.toFixed(2)}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gray-500">by {p.store || "Affisell"}</p>
      </div>
    </div>
  )
}
