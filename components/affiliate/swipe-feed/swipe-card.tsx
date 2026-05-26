"use client"

import Image from "next/image"
import { useRef } from "react"
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion"
import { useSwipeable } from "react-swipeable"
import { BadgePercent, Clock, Sparkles, Store, X, Heart } from "lucide-react"

import type { SwipeFeedProduct } from "@/lib/affiliate-swipe-feed-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD = 120
const EXIT_X = 520

type Props = {
  product: SwipeFeedProduct
  stackIndex: number
  isTop: boolean
  markupRate: number
  onSwipe: (direction: "left" | "right") => void
  onExitComplete?: () => void
}

export function SwipeCard({
  product,
  stackIndex,
  isTop,
  markupRate,
  onSwipe,
  onExitComplete,
}: Props) {
  const x = useMotionValue(0)
  const exitingRef = useRef(false)
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14])
  const likeOpacity = useTransform(x, [40, 140], [0, 1])
  const skipOpacity = useTransform(x, [-140, -40], [1, 0])
  const cardScale = 1 - stackIndex * 0.045
  const cardY = stackIndex * 10
  const sellingCents = Math.round(product.basePriceCents * (1 + markupRate))
  const projectedMargin = Math.max(0, sellingCents - product.basePriceCents)
  const heat = Math.min(100, product.commissionRate * 4)

  const flyOut = async (direction: "left" | "right") => {
    if (exitingRef.current || !isTop) return
    exitingRef.current = true
    await animate(x, direction === "right" ? EXIT_X : -EXIT_X, {
      type: "spring",
      stiffness: 280,
      damping: 28,
    })
    onSwipe(direction)
    onExitComplete?.()
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!isTop) return
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 700) {
      void flyOut("right")
      return
    }
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -700) {
      void flyOut("left")
      return
    }
    void animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => isTop && void flyOut("left"),
    onSwipedRight: () => isTop && void flyOut("right"),
    trackMouse: isTop,
    preventScrollOnSwipe: true,
    delta: 20,
  })

  return (
    <div
      {...(isTop ? swipeHandlers : {})}
      className={cn(
        "absolute inset-x-0 top-0 mx-auto w-full max-w-sm",
        !isTop && "pointer-events-none"
      )}
      style={{ zIndex: 30 - stackIndex }}
    >
      <motion.div
        className={cn("touch-none select-none", isTop && "cursor-grab active:cursor-grabbing")}
        style={{
          x: isTop ? x : 0,
          rotate: isTop ? rotate : 0,
          scale: cardScale,
          y: cardY,
        }}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={handleDragEnd}
        initial={false}
        layout={false}
      >
      <article
        className={cn(
          "relative overflow-hidden rounded-[1.75rem] border border-white/20 bg-zinc-950/90 shadow-2xl shadow-violet-950/40",
          "ring-1 ring-white/10 backdrop-blur-xl",
          isTop && "cursor-grab active:cursor-grabbing"
        )}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 384px"
              priority={isTop && stackIndex === 0}
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600">
              <Store className="size-16 opacity-40" aria-hidden />
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute left-4 top-4 rotate-[-12deg] rounded-xl border-2 border-emerald-400 bg-emerald-500/20 px-4 py-2 text-lg font-black uppercase tracking-widest text-emerald-300 backdrop-blur-sm"
          >
            <Heart className="mr-1 inline size-5" aria-hidden />
            Lister
          </motion.div>

          <motion.div
            style={{ opacity: skipOpacity }}
            className="absolute right-4 top-4 rotate-[12deg] rounded-xl border-2 border-rose-400 bg-rose-500/20 px-4 py-2 text-lg font-black uppercase tracking-widest text-rose-300 backdrop-blur-sm"
          >
            <X className="mr-1 inline size-5" aria-hidden />
            Passer
          </motion.div>

          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-300/90">
              <Sparkles className="size-3.5" aria-hidden />
              {product.supplierLabel}
            </p>
            <h2 className="line-clamp-2 text-xl font-bold leading-snug text-white">{product.name}</h2>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Prix fournisseur
              </p>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatStoreCurrencyFromCents(product.basePriceCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Vente +{Math.round(markupRate * 100)}%
              </p>
              <p className="text-lg font-semibold tabular-nums text-violet-200">
                {formatStoreCurrencyFromCents(sellingCents)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
              <BadgePercent className="size-3.5" aria-hidden />
              {product.commissionRate}% commission
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-3 py-1 text-sm font-medium text-violet-200 ring-1 ring-violet-400/25">
              +{formatStoreCurrencyFromCents(projectedMargin)} marge
            </span>
            {product.deliveryMax != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                <Clock className="size-3" aria-hidden />
                {product.deliveryMax}j livraison
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Potentiel commission</span>
              <span>{heat}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-all duration-500"
                style={{ width: `${heat}%` }}
              />
            </div>
          </div>
        </div>
      </article>
      </motion.div>
    </div>
  )
}
