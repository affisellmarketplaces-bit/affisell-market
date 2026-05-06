"use client"

import Image from "next/image"
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

  return (
    <div className="group">
      {/* CONTAINER IMAGE - Fixe 1:1, fond unique */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#F5F5F5]">
        {/* Badge Premium */}
        {product.isPremium ? (
          <div className="absolute left-3 top-3 z-10">
            <div className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white">
              Premium
            </div>
          </div>
        ) : null}

        {/* Wishlist */}
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur transition-all hover:bg-white"
        >
          <Heart className="h-4 w-4 text-gray-700" />
        </button>

        {/* IMAGE - object-contain = jamais coupée */}
        <Image
          src={src}
          alt={product.title}
          fill
          unoptimized
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Quick add hover */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white hover:bg-gray-800"
          >
            Quick add
          </button>
        </div>
      </div>

      {/* INFOS PRODUIT */}
      <div className="mt-3 px-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-medium text-gray-900">{product.title}</h3>
          <div className="text-right">
            {product.compareAt != null &&
            typeof product.compareAt === "number" &&
            product.compareAt > product.price ? (
              <p className="text-xs text-gray-400 line-through">{formatUsd(product.compareAt)}</p>
            ) : null}
            <p className="text-base font-bold text-gray-900">{formatUsd(product.price)}</p>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">by {product.store}</p>
      </div>
    </div>
  )
}
