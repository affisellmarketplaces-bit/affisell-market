"use client"

import Image from "next/image"
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
import { BadgePercent, Clock, Heart, Sparkles, Store, X, Zap } from "lucide-react"

import type { SwipeFeedProduct } from "@/lib/affiliate-swipe-feed-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD = 72
const VELOCITY_COMMIT = 420
const EXIT_X = 640

export type SwipeCardHandle = {
  /** Animate card off-screen, then invoke `onSwipeComplete`. */
  swipe: (direction: "left" | "right") => void
  /** Snap back after a failed API call. */
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

  const rotate = useTransform(x, [-280, 0, 280], [-18, 0, 18])
  const rotateY = useTransform(x, [-280, 0, 280], [8, 0, -8])
  const cardScale = useTransform(x, [-180, 0, 180], [0.97, 1, 0.97])
  const stackScale = 1 - stackIndex * 0.048
  const stackY = stackIndex * 12

  /** Image parallax — moves faster than card for depth. */
  const imageX = useTransform(x, (v) => v * 0.42)
  const imageScale = useTransform(x, [-220, 0, 220], [1.12, 1.06, 1.12])
  const imageRotate = useTransform(x, [-220, 0, 220], [-2, 0, 2])

  const likeOpacity = useTransform(x, [18, 110], [0, 1])
  const skipOpacity = useTransform(x, [-110, -18], [1, 0])
  const likeScale = useTransform(x, [18, 110], [0.6, 1])
  const skipScale = useTransform(x, [-110, -18], [1, 0.6])

  const rightGlow = useTransform(x, [0, 140], [0, 0.85])
  const leftGlow = useTransform(x, [-140, 0], [0.85, 0])
  const streakRight = useTransform(x, [0, 160], [0, 1])
  const streakLeft = useTransform(x, [-160, 0], [1, 0])
  const streakRightX = useTransform(x, [0, 200], [-40, 80])
  const streakLeftX = useTransform(x, [-200, 0], [-80, 40])

  const sellingCents = Math.round(product.basePriceCents * (1 + markupRate))
  const projectedMargin = Math.max(0, sellingCents - product.basePriceCents)
  const heat = Math.min(100, product.commissionRate * 4)

  const flyOut = useCallback(
    async (direction: "left" | "right") => {
      if (exitingRef.current || !isTop) return
      exitingRef.current = true
      onDragProgress?.(direction === "right" ? 1 : -1)

      const target = direction === "right" ? EXIT_X : -EXIT_X
      await Promise.all([
        animate(x, target, {
          type: "spring",
          stiffness: 520,
          damping: 34,
          mass: 0.65,
          velocity: direction === "right" ? 800 : -800,
        }),
      ])

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
    const progress = Math.max(-1, Math.min(1, info.offset.x / 140))
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
        "absolute inset-x-0 top-0 mx-auto w-full max-w-sm",
        !isTop && "pointer-events-none"
      )}
      style={{
        zIndex: 30 - stackIndex,
        y: stackY,
        scale: isTop ? stackScale : stackScale,
      }}
      initial={stackIndex > 0 ? { scale: stackScale - 0.04, opacity: 0.7 } : false}
      animate={{ scale: stackScale, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <motion.div
        className={cn(
          "touch-none select-none [perspective:1200px]",
          isTop && "cursor-grab active:cursor-grabbing"
        )}
        style={{
          x: isTop ? x : 0,
          rotate: isTop ? rotate : 0,
          rotateY: isTop ? rotateY : 0,
          scale: isTop ? cardScale : 1,
        }}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragMomentum
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        <article
          className={cn(
            "relative overflow-hidden rounded-[1.85rem]",
            "border border-white/[0.12] bg-zinc-950/95",
            "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-12px_rgba(88,28,135,0.55)]",
            "ring-1 ring-inset ring-white/[0.06]"
          )}
        >
          {/* Animated holo border */}
          <div className="pointer-events-none absolute inset-0 z-20 rounded-[1.85rem] bg-gradient-to-br from-violet-500/20 via-transparent to-fuchsia-500/20 opacity-60" />
          <div className="pointer-events-none absolute inset-[1px] z-20 rounded-[1.82rem] border border-white/10" />

          {/* Directional edge glow */}
          <motion.div
            style={{ opacity: rightGlow }}
            className="pointer-events-none absolute inset-0 z-10 rounded-[1.85rem] bg-gradient-to-l from-emerald-500/35 via-emerald-500/10 to-transparent"
          />
          <motion.div
            style={{ opacity: leftGlow }}
            className="pointer-events-none absolute inset-0 z-10 rounded-[1.85rem] bg-gradient-to-r from-rose-500/35 via-rose-500/10 to-transparent"
          />

          {/* Motion streaks */}
          <motion.div
            style={{ opacity: streakRight, x: streakRightX }}
            className="pointer-events-none absolute inset-y-8 right-0 z-10 w-24 bg-gradient-to-l from-emerald-400/30 to-transparent blur-xl"
          />
          <motion.div
            style={{ opacity: streakLeft, x: streakLeftX }}
            className="pointer-events-none absolute inset-y-8 left-0 z-10 w-24 bg-gradient-to-r from-rose-400/30 to-transparent blur-xl"
          />

          <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
            {product.imageUrl ? (
              <motion.div
                className="absolute inset-[-8%] will-change-transform"
                style={{
                  x: isTop ? imageX : 0,
                  scale: isTop ? imageScale : 1.06,
                  rotate: isTop ? imageRotate : 0,
                }}
              >
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 384px"
                  priority={isTop && stackIndex === 0}
                  draggable={false}
                />
              </motion.div>
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <Store className="size-16 opacity-40" aria-hidden />
              </div>
            )}

            {/* Scanlines — futuristic HUD */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
              }}
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-zinc-950/10" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-fuchsia-600/10" />

            {/* LIKE stamp */}
            <motion.div
              style={{ opacity: likeOpacity, scale: likeScale }}
              className="absolute left-5 top-5 z-20 origin-center"
            >
              <div className="flex items-center gap-2 rounded-2xl border-2 border-emerald-400/90 bg-emerald-500/25 px-4 py-2.5 shadow-[0_0_24px_rgba(52,211,153,0.45)] backdrop-blur-md">
                <Heart className="size-5 fill-emerald-300 text-emerald-300" aria-hidden />
                <span className="text-base font-black uppercase tracking-[0.2em] text-emerald-200">
                  Lister
                </span>
              </div>
            </motion.div>

            {/* SKIP stamp */}
            <motion.div
              style={{ opacity: skipOpacity, scale: skipScale }}
              className="absolute right-5 top-5 z-20 origin-center"
            >
              <div className="flex items-center gap-2 rounded-2xl border-2 border-rose-400/90 bg-rose-500/25 px-4 py-2.5 shadow-[0_0_24px_rgba(251,113,133,0.45)] backdrop-blur-md">
                <X className="size-5 text-rose-300" aria-hidden />
                <span className="text-base font-black uppercase tracking-[0.2em] text-rose-200">
                  Passer
                </span>
              </div>
            </motion.div>

            <div className="absolute bottom-0 left-0 right-0 z-10 p-5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">
                <Sparkles className="size-3" aria-hidden />
                {product.supplierLabel}
              </p>
              <h2 className="line-clamp-2 text-xl font-bold leading-snug tracking-tight text-white drop-shadow-lg">
                {product.name}
              </h2>
            </div>
          </div>

          <div className="relative space-y-3 p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Prix fournisseur
                </p>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-white">
                  {formatStoreCurrencyFromCents(product.basePriceCents)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Vente +{Math.round(markupRate * 100)}%
                </p>
                <p className="bg-gradient-to-r from-violet-200 to-fuchsia-200 bg-clip-text text-lg font-bold tabular-nums text-transparent">
                  {formatStoreCurrencyFromCents(sellingCents)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/35">
                <BadgePercent className="size-3" aria-hidden />
                {product.commissionRate}% commission
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/30">
                <Zap className="size-3" aria-hidden />+
                {formatStoreCurrencyFromCents(projectedMargin)}
              </span>
              {product.deliveryMax != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-400">
                  <Clock className="size-3" aria-hidden />
                  {product.deliveryMax}j
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                <span>Signal commission</span>
                <span className="text-violet-400">{heat}%</span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_12px_rgba(167,139,250,0.6)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${heat}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.15 }}
                />
              </div>
            </div>
          </div>
        </article>
      </motion.div>
    </motion.div>
  )
})
