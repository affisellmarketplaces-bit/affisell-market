"use client"

import { motion } from "framer-motion"
import { Heart, Star } from "lucide-react"
import Link from "next/link"
import type { MouseEvent } from "react"
import { useMemo, useState } from "react"

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
  comparePrice?: number
  compareAt?: number
  rating?: number
  reviewCount?: number
  sellerName: string
  /** Amazon-style top-left badge (top 3 only) */
  amazonBadge?: ProductCardBadge
  /** Show Prime line instead of free delivery tomorrow */
  isPrime?: boolean
  /** When true and not Prime: show fast delivery hint */
  freeDeliveryTomorrow?: boolean
  secondaryImageUrl?: string | null
  previewVideoUrl?: string | null
  isPremium?: boolean
  discount?: number
  stock?: number
  isBestseller?: boolean
  soldThisWeek?: number
  colorVariants?: string[]
  category?: "fashion" | "tech" | string
  onQuickAdd?: (listingId: string) => void
  onToggleFavorite?: (listingId: string) => void
  isFavorite?: boolean
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "destructive" | "warning"
}) {
  const cls =
    variant === "destructive"
      ? "bg-red-600 text-white"
      : variant === "warning"
        ? "bg-amber-500 text-white"
        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold shadow ${cls}`}>
      {children}
    </span>
  )
}

export function ProductCard({
  listingId,
  href,
  imageUrl,
  title,
  price,
  originalPrice,
  comparePrice,
  compareAt,
  rating = 4.5,
  sellerName,
  secondaryImageUrl,
  previewVideoUrl,
  isPremium = false,
  discount,
  stock = 999,
  isBestseller = false,
  soldThisWeek = 234,
  colorVariants = [],
  category = "tech",
  onQuickAdd,
  onToggleFavorite,
  isFavorite = false,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false)
  const img = imageUrl || "/placeholder.png"
  const secondImg = secondaryImageUrl?.trim() || null
  const shouldUseFashionRatio = String(category).toLowerCase().includes("fashion")
  const compare = compareAt ?? comparePrice ?? originalPrice
  const savePercent =
    compare != null && compare > price ? Math.round(((compare - price) / compare) * 100) : 0
  const ratioClass = shouldUseFashionRatio ? "aspect-[3/4]" : "aspect-square"

  const displayMedia = useMemo(() => {
    if (hovered && previewVideoUrl) return "video"
    if (hovered && secondImg) return "secondary"
    return "primary"
  }, [hovered, previewVideoUrl, secondImg])

  function handleAddToCart(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onQuickAdd?.(listingId)
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

  function handleFavorite(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavorite?.(listingId)
  }

  return (
    <motion.article
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg transition-all duration-300 hover:shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={href} className="flex flex-1 flex-col">
        <div className={`relative w-full overflow-hidden bg-white dark:bg-zinc-900 ${ratioClass}`}>
          <motion.div
            className="h-full w-full"
            animate={{ scale: hovered ? 1.05 : 1 }}
            transition={{ duration: 0.3 }}
          >
            {displayMedia === "video" ? (
              <video
                src={previewVideoUrl ?? undefined}
                className="h-full w-full object-cover"
                muted
                autoPlay
                loop
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- remote supplier images
              <img
                src={displayMedia === "secondary" ? secondImg ?? img : img}
                alt={title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.png"
                }}
              />
            )}
          </motion.div>

          <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
            {isPremium ? <Badge>Premium</Badge> : null}
            {typeof discount === "number" && discount > 0 ? (
              <Badge variant="destructive">-{Math.round(discount)}%</Badge>
            ) : null}
            {stock < 5 ? <Badge variant="warning">Only {stock} left</Badge> : null}
            {isBestseller ? <Badge>Bestseller</Badge> : null}
          </div>

          <button
            type="button"
            onClick={handleFavorite}
            aria-label="Favorite"
            className="absolute right-3 top-3 z-20 rounded-full bg-white/95 p-2 text-zinc-700 shadow transition hover:bg-white dark:bg-zinc-900/90 dark:text-zinc-200"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-current text-red-500" : ""}`} />
          </button>

          {colorVariants.length > 0 ? (
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
              {colorVariants.slice(0, 5).map((color) => (
                <span
                  key={color}
                  className="h-3 w-3 rounded-full border border-white/80 shadow"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          ) : null}

          <motion.button
            type="button"
            onClick={handleAddToCart}
            className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
            transition={{ duration: 0.2 }}
          >
            Quick Add
          </motion.button>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
          <h3 className="line-clamp-2 min-h-10 text-left text-sm font-semibold leading-5 text-zinc-900 hover:underline dark:text-zinc-100">
            {title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{rating.toFixed(1)}</span>
            <span>•</span>
            <span>{soldThisWeek} sold this week</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{formatUsd(price)}</span>
            {compare != null && compare > price ? (
              <span className="text-sm text-zinc-500 line-through dark:text-zinc-400">
                {formatUsd(compare)}
              </span>
            ) : null}
            {savePercent > 0 ? (
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                SAVE {savePercent}%
              </span>
            ) : null}
          </div>

          <p className="mt-auto truncate text-xs text-zinc-500 dark:text-zinc-400">
            Sold by <span className="text-zinc-700 dark:text-zinc-300">{sellerName}</span>
          </p>
        </div>
      </Link>
    </motion.article>
  )
}
