"use client"

import { Heart } from "lucide-react"

export type ProductCardProduct = {
  title: string
  image: string
  price: number
  compareAt?: number | null
  store: string
  isPremium?: boolean
}

type ProductCardProps = {
  product: ProductCardProduct
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ProductCard({ product }: ProductCardProps) {
  const src = product.image?.trim() || "/placeholder.png"
  const hasCompare =
    product.compareAt != null &&
    typeof product.compareAt === "number" &&
    product.compareAt > product.price
  const savePercent =
    hasCompare && product.compareAt != null
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : 0

  return (
    <div className="group">
      <div className="relative overflow-hidden rounded-2xl bg-[#F5F5F5] aspect-square w-full">
        {product.isPremium ? (
          <div className="absolute left-3 top-3 z-10">
            <div className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white">
              Premium
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur transition-all hover:bg-white"
        >
          <Heart className="h-4 w-4 text-gray-700" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element -- uniform contain box; remote supplier URLs */}
        <img
          src={src}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.png"
          }}
        />

        <div className="pointer-events-none absolute inset-x-3 bottom-3 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            className="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white hover:bg-gray-800"
          >
            Quick add
          </button>
        </div>
      </div>

      <div className="mt-3 px-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-medium text-gray-900">{product.title}</h3>
          <div className="text-right">
            {hasCompare && product.compareAt != null ? (
              <p className="text-xs text-gray-400 line-through">{formatUsd(product.compareAt)}</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <p className="text-base font-bold text-gray-900">{formatUsd(product.price)}</p>
              {savePercent > 0 ? (
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  SAVE {savePercent}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">by {product.store}</p>
      </div>
    </div>
  )
}
