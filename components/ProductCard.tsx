"use client"

import { Heart } from "lucide-react"

export type ProductCardProduct = {
  title: string
  image: string
  price: number | string
  compareAt?: number | string | null
  store?: string | null
}

type ProductCardProps = {
  product: ProductCardProduct
}

function moneyLabel(value: number | string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ProductCard({ product }: ProductCardProps) {
  const priceN = Number(product.price)
  const compareN = product.compareAt != null && product.compareAt !== "" ? Number(product.compareAt) : NaN
  const hasDiscount = Number.isFinite(compareN) && Number.isFinite(priceN) && compareN > priceN
  const discount = hasDiscount ? Math.round(((compareN - priceN) / compareN) * 100) : 0

  return (
    <div className="group">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#F5F5F5]">
        {hasDiscount ? (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-3 py-1.5 text-xs font-black text-white">
            SAVE {discount}%
          </div>
        ) : null}
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur transition-all hover:bg-white"
        >
          <Heart className="h-4 w-4 text-gray-700" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote supplier URLs */}
        <img
          src={product.image?.trim() || "/placeholder.png"}
          alt={product.title}
          className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.png"
          }}
        />
      </div>

      <div className="mt-3 px-1">
        <h3 className="line-clamp-2 text-sm font-medium text-gray-900">{product.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-black text-gray-900">{moneyLabel(product.price)}</span>
          {hasDiscount ? (
            <span className="text-sm text-gray-400 line-through">{moneyLabel(compareN)}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gray-500">by {product.store || "Affisell"}</p>
      </div>
    </div>
  )
}
