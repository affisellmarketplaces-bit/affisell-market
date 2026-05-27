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
import { Heart, X } from "lucide-react"

import { AffiliatePromoProductCard } from "@/components/affiliate/affiliate-promo-product-card"
import type { SwipeFeedProduct } from "@/lib/affiliate-swipe-feed-types"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD = 72
const VELOCITY_COMMIT = 420
const EXIT_X = 640

export type SwipeCardHandle = {
  swipe: (direction: "left" | "right") => void
  reset: () => void
}

type Props = {
  product: SwipeFeedProduct
  stackIndex: number
  isTop: boolean
  markupRate: number
  onSwipeComplete: (direction: "left" | "right") => void
  onDragProgress?: (progress: number) => void
}

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { product, stackIndex, isTop, markupRate, onSwipeComplete, onDragProgress },
  ref
) {
  const x = useMotionValue(0)
  const exitingRef = useRef(false)

  const rotate = useTransform(x, [-260, 0, 260], [-10, 0, 10])
  const cardScale = useTransform(x, [-160, 0, 160], [0.98, 1, 0.98])
  const stackScale = 1 - stackIndex * 0.04
  const stackY = stackIndex * 10

  const likeOpacity = useTransform(x, [20, 100], [0, 1])
  const skipOpacity = useTransform(x, [-100, -20], [1, 0])
  const likeScale = useTransform(x, [20, 100], [0.85, 1])
  const skipScale = useTransform(x, [-100, -20], [1, 0.85])

  const rightGlow = useTransform(x, [0, 120], [0, 0.35])
  const leftGlow = useTransform(x, [-120, 0], [0.35, 0])

  const sellingCents = Math.round(product.basePriceCents * (1 + markupRate))
  const displayMargin =
    product.marginCents > 0
      ? product.marginCents
      : Math.max(0, sellingCents - product.basePriceCents)

  const flyOut = useCallback(
    async (direction: "left" | "right") => {
      if (exitingRef.current || !isTop) return
      exitingRef.current = true
      onDragProgress?.(direction === "right" ? 1 : -1)

      const target = direction === "right" ? EXIT_X : -EXIT_X
      await animate(x, target, {
        type: "spring",
        stiffness: 480,
        damping: 32,
        mass: 0.7,
        velocity: direction === "right" ? 720 : -720,
      })

      onSwipeComplete(direction)
    },
    [isTop, onDragProgress, onSwipeComplete, x]
  )

  useImperativeHandle(ref, () => ({
    swipe: (direction) => {
      void flyOut(direction)
    },
    reset: () => {
      exitingRef.current = false
      onDragProgress?.(0)
      void animate(x, 0, { type: "spring", stiffness: 520, damping: 34 })
    },
  }))

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (!isTop) return
    const progress = Math.max(-1, Math.min(1, info.offset.x / 130))
    onDragProgress?.(progress)
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!isTop || exitingRef.current) return

    const offset = info.offset.x
    const velocity = info.velocity.x

    if (offset > SWIPE_THRESHOLD || velocity > VELOCITY_COMMIT) {
      void flyOut("right")
      return
    }
    if (offset < -SWIPE_THRESHOLD || velocity < -VELOCITY_COMMIT) {
      void flyOut("left")
      return
    }

    onDragProgress?.(0)
    void animate(x, 0, { type: "spring", stiffness: 680, damping: 38, mass: 0.5 })
  }

  return (
    <motion.div
      className={cn(
        "absolute inset-x-0 top-0 mx-auto w-full max-w-[340px]",
        !isTop && "pointer-events-none"
      )}
      style={{
        zIndex: 30 - stackIndex,
        y: stackY,
        scale: stackScale,
      }}
      initial={stackIndex > 0 ? { scale: stackScale - 0.03, opacity: 0.92 } : false}
      animate={{ scale: stackScale, opacity: stackIndex === 0 ? 1 : 0.94 - stackIndex * 0.06 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <motion.div
        className={cn(
          "touch-none select-none",
          isTop && "cursor-grab active:cursor-grabbing"
        )}
        style={{
          x: isTop ? x : 0,
          rotate: isTop ? rotate : 0,
          scale: isTop ? cardScale : 1,
        }}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        dragMomentum
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        <article className="relative">
          {/* Aura futuriste autour de la carte catalogue */}
          {isTop ? (
            <div
              className="pointer-events-none absolute -inset-3 rounded-[2rem] opacity-80"
              style={{
                background:
                  "conic-gradient(from 180deg at 50% 50%, rgba(139,92,246,0.35), rgba(45,212,191,0.2), rgba(236,72,153,0.25), rgba(139,92,246,0.35))",
                filter: "blur(18px)",
              }}
              aria-hidden
            />
          ) : null}

          <motion.div
            style={{ opacity: rightGlow }}
            className="pointer-events-none absolute -inset-1 z-0 rounded-[1.65rem] bg-emerald-400/25 blur-md"
          />
          <motion.div
            style={{ opacity: leftGlow }}
            className="pointer-events-none absolute -inset-1 z-0 rounded-[1.65rem] bg-rose-400/25 blur-md"
          />

          <div
            className={cn(
              "relative z-10 overflow-hidden rounded-3xl",
              isTop &&
                "shadow-[0_20px_50px_-12px_rgba(88,28,135,0.25),0_8px_24px_-8px_rgba(0,0,0,0.12)]",
              "dark:shadow-[0_24px_60px_-16px_rgba(0,0,0,0.55)]"
            )}
          >
            <AffiliatePromoProductCard
              name={product.name}
              imageUrl={product.imageUrl}
              images={product.images}
              basePriceCents={product.basePriceCents}
              marginCents={displayMargin}
              commissionRate={product.commissionRate}
              supplierLabel={product.supplierLabel}
              sellingPriceCents={sellingCents}
              priority={isTop && stackIndex === 0}
              className="h-full border-0 shadow-none ring-0"
            />

            {/* Stamps swipe — n’obscurcissent pas la photo */}
            <motion.div
              style={{ opacity: likeOpacity, scale: likeScale }}
              className="pointer-events-none absolute left-3 top-[42%] z-20 -translate-y-1/2"
            >
              <div className="flex items-center gap-2 rounded-2xl border-2 border-emerald-500 bg-white/95 px-3.5 py-2 shadow-lg shadow-emerald-500/20 backdrop-blur-sm dark:bg-zinc-950/95">
                <Heart className="size-5 fill-emerald-500 text-emerald-500" aria-hidden />
                <span className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Éditer
                </span>
              </div>
            </motion.div>

            <motion.div
              style={{ opacity: skipOpacity, scale: skipScale }}
              className="pointer-events-none absolute right-3 top-[42%] z-20 -translate-y-1/2"
            >
              <div className="flex items-center gap-2 rounded-2xl border-2 border-rose-500 bg-white/95 px-3.5 py-2 shadow-lg shadow-rose-500/20 backdrop-blur-sm dark:bg-zinc-950/95">
                <X className="size-5 text-rose-500" aria-hidden />
                <span className="text-sm font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Passer
                </span>
              </div>
            </motion.div>
          </div>
        </article>
      </motion.div>
    </motion.div>
  )
})
