"use client"

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react"
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion"
import {
  Bookmark,
  ChevronLeft,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react"
import Image from "next/image"

import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { affisellBrand } from "@/lib/affisell-brand"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD = 64
const VELOCITY_COMMIT = 380
const EXIT = 520

export type BuyerSwipeDirection = "up" | "down" | "left" | "right"

export type BuyerSwipeCardHandle = {
  swipe: (direction: BuyerSwipeDirection) => void
  reset: () => void
}

type Props = {
  item: PulseFeedItem
  stackIndex: number
  isTop: boolean
  onSwipeComplete: (direction: BuyerSwipeDirection) => void
  onDragProgress?: (progress: { x: number; y: number }) => void
}

export const BuyerSwipeCard = forwardRef<BuyerSwipeCardHandle, Props>(function BuyerSwipeCard(
  { item, stackIndex, isTop, onSwipeComplete, onDragProgress },
  ref
) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const exitingRef = useRef(false)

  const rotate = useTransform(x, [-220, 0, 220], [-8, 0, 8])
  const stackScale = 1 - stackIndex * 0.04
  const stackY = stackIndex * 12

  const cartOpacity = useTransform(y, [-20, -90], [0, 1])
  const saveOpacity = useTransform(y, [20, 90], [0, 1])
  const buyOpacity = useTransform(x, [20, 90], [0, 1])
  const skipOpacity = useTransform(x, [-90, -20], [1, 0])

  const priceEur = item.priceCents / 100
  const compareEur = item.compareAtCents != null ? item.compareAtCents / 100 : null

  const flyOut = useCallback(
    async (direction: BuyerSwipeDirection) => {
      if (exitingRef.current || !isTop) return
      exitingRef.current = true

      const target =
        direction === "right"
          ? { x: EXIT, y: 0 }
          : direction === "left"
            ? { x: -EXIT, y: 0 }
            : direction === "up"
              ? { x: 0, y: -EXIT }
              : { x: 0, y: EXIT }

      onDragProgress?.({ x: 0, y: 0 })
      await Promise.all([
        animate(x, target.x, { type: "spring", stiffness: 460, damping: 34 }),
        animate(y, target.y, { type: "spring", stiffness: 460, damping: 34 }),
      ])

      onSwipeComplete(direction)
    },
    [isTop, onDragProgress, onSwipeComplete, x, y]
  )

  useImperativeHandle(ref, () => ({
    swipe: (direction) => {
      void flyOut(direction)
    },
    reset: () => {
      exitingRef.current = false
      onDragProgress?.({ x: 0, y: 0 })
      void Promise.all([
        animate(x, 0, { type: "spring", stiffness: 520, damping: 34 }),
        animate(y, 0, { type: "spring", stiffness: 520, damping: 34 }),
      ])
    },
  }))

  const resolveDirection = (offset: { x: number; y: number }, velocity: { x: number; y: number }) => {
    const absX = Math.abs(offset.x)
    const absY = Math.abs(offset.y)
    if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return null

    if (absX >= absY) {
      if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_COMMIT) return "right" as const
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_COMMIT) return "left" as const
      return null
    }
    if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_COMMIT) return "up" as const
    if (offset.y > SWIPE_THRESHOLD || velocity.y > VELOCITY_COMMIT) return "down" as const
    return null
  }

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (!isTop) return
    const px = Math.max(-1, Math.min(1, info.offset.x / 110))
    const py = Math.max(-1, Math.min(1, info.offset.y / 110))
    onDragProgress?.({ x: px, y: py })
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!isTop || exitingRef.current) return
    const direction = resolveDirection(info.offset, info.velocity)
    if (direction) {
      void flyOut(direction)
      return
    }
    onDragProgress?.({ x: 0, y: 0 })
    void Promise.all([
      animate(x, 0, { type: "spring", stiffness: 680, damping: 38 }),
      animate(y, 0, { type: "spring", stiffness: 680, damping: 38 }),
    ])
  }

  return (
    <motion.div
      className={cn(
        "absolute inset-x-0 top-0 mx-auto w-full max-w-[360px]",
        !isTop && "pointer-events-none"
      )}
      style={{ zIndex: 30 - stackIndex, y: stackY, scale: stackScale }}
      animate={{ scale: stackScale, opacity: stackIndex === 0 ? 1 : 0.92 - stackIndex * 0.06 }}
    >
      <motion.div
        className={cn("touch-none select-none", isTop && "cursor-grab active:cursor-grabbing")}
        style={{ x: isTop ? x : 0, y: isTop ? y : 0, rotate: isTop ? rotate : 0 }}
        drag={isTop}
        dragElastic={0.45}
        dragMomentum
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        <article className={cn(affisellBrand.epoxySurface, "relative overflow-hidden rounded-[1.75rem]")}>
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
            <div className="absolute inset-0">
              {item.isVideo ? (
                <video
                  src={item.mediaUrl}
                  className="h-full w-full object-cover opacity-40 blur-xl scale-105"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.mediaUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-40 blur-xl scale-105"
                  aria-hidden
                />
              )}
            </div>
            <div className="relative z-[1] flex h-full w-full items-center justify-center p-3">
              {item.isVideo ? (
                <video
                  src={item.mediaUrl}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
                  muted
                  loop
                  playsInline
                  preload={isTop ? "auto" : "metadata"}
                />
              ) : item.mediaUrl.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.mediaUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
                />
              ) : (
                <Image
                  src={item.mediaUrl}
                  alt=""
                  width={400}
                  height={400}
                  className="max-h-full max-w-full object-contain"
                  unoptimized
                />
              )}
            </div>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75"
              aria-hidden
            />
          </div>

          <motion.div
            style={{ opacity: cartOpacity }}
            className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2"
          >
            <div className={cn(affisellBrand.epoxyGestureBadge, "flex items-center gap-2 border-emerald-300/50 text-emerald-100")}>
              <ShoppingBag className="size-5 text-emerald-300" />
              <span className="text-xs font-black uppercase tracking-wider">Panier</span>
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: saveOpacity }}
            className="pointer-events-none absolute bottom-32 left-1/2 z-20 -translate-x-1/2"
          >
            <div className={cn(affisellBrand.epoxyGestureBadge, "flex items-center gap-2 border-amber-300/50 text-amber-100")}>
              <Bookmark className="size-5 text-amber-200" />
              <span className="text-xs font-black uppercase tracking-wider">Save Drop</span>
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: buyOpacity }}
            className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2"
          >
            <div className={cn(affisellBrand.epoxyGestureBadge, "flex items-center gap-2 border-violet-300/50 text-violet-100")}>
              <Zap className="size-5 text-violet-200" />
              <span className="text-xs font-black uppercase tracking-wider">Acheter</span>
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: skipOpacity }}
            className="pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2"
          >
            <div className={cn(affisellBrand.epoxyGestureBadge, "flex items-center gap-2 text-white")}>
              <ChevronLeft className="size-5" />
              <span className="text-xs font-black uppercase tracking-wider">Suivant</span>
            </div>
          </motion.div>

          <div className="relative z-[2] border-t border-white/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {item.boosted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-100 ring-1 ring-cyan-400/30">
                  <Sparkles className="size-3" />
                  Hot
                </span>
              ) : null}
              {item.soldCount > 0 ? (
                <ProductSalesBadge count={item.soldCount} variant="inline" className="!bg-white/10 !text-white" />
              ) : null}
            </div>
            <h2 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-white">{item.title}</h2>
            {item.priceCents > 0 ? (
              <div className="mt-2 [&_span]:!text-white [&_p]:!text-white/70">
                <ProductPriceOffer price={priceEur} compareAt={compareEur} layout="compact" />
              </div>
            ) : null}
            {item.storeName ? (
              <p className="mt-2 truncate text-xs text-zinc-400">{item.storeName}</p>
            ) : null}
          </div>
        </article>
      </motion.div>
    </motion.div>
  )
})
