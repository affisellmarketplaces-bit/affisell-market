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
  type MotionValue,
  type PanInfo,
} from "framer-motion"
import { useTranslations } from "next-intl"
import {
  Bookmark,
  ChevronLeft,
  ShoppingBag,
  Zap,
} from "lucide-react"

import { affisellBrand } from "@/lib/affisell-brand"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { cn } from "@/lib/utils"

import { PulseProductMediaStage } from "@/components/pulse/pulse-product-media-stage"

const SWIPE_THRESHOLD = 64
const VELOCITY_COMMIT = 380
const EXIT = 520

export type BuyerSwipeDirection = "up" | "down" | "left" | "right"

const SWIPE_GLYPH: Record<BuyerSwipeDirection, string> = {
  up: "↑",
  left: "←",
  right: "→",
  down: "↓",
}

function SwipeGestureHint({
  direction,
  icon: Icon,
  label,
  iconClassName,
  badgeClassName,
  style,
  className,
}: {
  direction: BuyerSwipeDirection
  icon: typeof ShoppingBag
  label: string
  iconClassName?: string
  badgeClassName?: string
  style?: { opacity: MotionValue<number> }
  className?: string
}) {
  return (
    <motion.div style={style} className={className}>
      <div
        className={cn(
          affisellBrand.epoxyGestureBadge,
          "flex items-center gap-1.5 px-3 py-2 sm:gap-2",
          badgeClassName
        )}
      >
        <span className="text-sm font-black leading-none sm:hidden" aria-hidden>
          {SWIPE_GLYPH[direction]}
        </span>
        <Icon className={cn("size-5 shrink-0", iconClassName)} aria-hidden />
        <span className="text-[11px] font-black uppercase tracking-wider sm:text-xs">{label}</span>
      </div>
    </motion.div>
  )
}

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
  const t = useTranslations("pulse.commerce")
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
        "absolute inset-0 mx-auto h-full w-full max-w-[360px]",
        !isTop && "pointer-events-none"
      )}
      style={{ zIndex: 30 - stackIndex, y: stackY, scale: stackScale }}
      animate={{ scale: stackScale, opacity: stackIndex === 0 ? 1 : 0.92 - stackIndex * 0.06 }}
    >
      <motion.div
        className={cn("h-full touch-none select-none", isTop && "cursor-grab active:cursor-grabbing")}
        style={{ x: isTop ? x : 0, y: isTop ? y : 0, rotate: isTop ? rotate : 0 }}
        drag={isTop}
        dragElastic={0.45}
        dragMomentum
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        <article
          className={cn(
            affisellBrand.epoxySurface,
            "relative flex h-full flex-col overflow-hidden rounded-[1.35rem] sm:rounded-[1.75rem]"
          )}
        >
          <PulseProductMediaStage
            item={item}
            active={isTop}
            instantReveal={isTop && stackIndex === 0}
            className="relative min-h-0 flex-1"
          />

          <SwipeGestureHint
            direction="up"
            icon={ShoppingBag}
            label={t("cartShort")}
            iconClassName="text-emerald-300"
            badgeClassName="border-emerald-300/50 text-emerald-100"
            style={{ opacity: cartOpacity }}
            className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2"
          />

          <SwipeGestureHint
            direction="down"
            icon={Bookmark}
            label={t("saveDropShort")}
            iconClassName="text-amber-200"
            badgeClassName="border-amber-300/50 text-amber-100"
            style={{ opacity: saveOpacity }}
            className="pointer-events-none absolute bottom-[38%] left-1/2 z-20 -translate-x-1/2"
          />

          <SwipeGestureHint
            direction="right"
            icon={Zap}
            label={t("buyShort")}
            iconClassName="text-violet-200"
            badgeClassName="border-violet-300/50 text-violet-100"
            style={{ opacity: buyOpacity }}
            className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-4"
          />

          <SwipeGestureHint
            direction="left"
            icon={ChevronLeft}
            label={t("skipShort")}
            badgeClassName="text-white"
            style={{ opacity: skipOpacity }}
            className="pointer-events-none absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-4"
          />
        </article>
      </motion.div>
    </motion.div>
  )
})
