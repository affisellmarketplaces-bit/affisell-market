"use client"

import {
  Bookmark,
  ChevronLeft,
  RotateCcw,
  ShoppingBag,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import type { BuyerSwipeDirection } from "@/components/pulse/buyer-swipe-card"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

type SwipeDockDirection = BuyerSwipeDirection

const DIRECTION_GLYPH: Record<SwipeDockDirection, string> = {
  up: "↑",
  left: "←",
  right: "→",
  down: "↓",
}

type DockButtonProps = {
  direction?: SwipeDockDirection
  label: string
  ariaLabel: string
  icon: LucideIcon
  disabled?: boolean
  onClick: () => void
  variant?: "default" | "cart" | "buy" | "drop"
  className?: string
  layout?: "mobile" | "desktop"
}

function DockButton({
  direction,
  label,
  ariaLabel,
  icon: Icon,
  disabled,
  onClick,
  variant = "default",
  className,
  layout = "desktop",
}: DockButtonProps) {
  const shell =
    variant === "buy"
      ? affisellBrand.epoxyActionBuy
      : variant === "cart"
        ? affisellBrand.epoxyActionCart
        : variant === "drop"
          ? affisellBrand.epoxyActionDrop
          : affisellBrand.epoxyActionBtn

  const mobile = layout === "mobile"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={direction ? `pulse-swipe-dock-${direction}` : "pulse-swipe-dock-undo"}
      className={cn(
        shell,
        "touch-manipulation transition-transform active:scale-[0.97]",
        mobile
          ? cn(
              "flex aspect-square min-h-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1",
              variant === "buy" &&
                "aspect-auto min-h-[3.35rem] rounded-[1.15rem] shadow-[0_0_28px_-6px_rgba(124,58,237,0.85)]"
            )
          : "min-h-[2.75rem] w-full gap-1 px-1 py-2 sm:min-h-0 sm:gap-0.5 sm:py-2",
        variant === "buy" && !mobile && "sm:shadow-lg",
        className
      )}
    >
      <Icon
        className={cn("shrink-0", mobile ? "size-[1.15rem]" : "size-[18px] sm:size-5")}
        aria-hidden
      />
      <DockActionLabel direction={direction} layout={layout}>
        {label}
      </DockActionLabel>
    </button>
  )
}

function DockActionLabel({
  direction,
  layout,
  children,
}: {
  direction?: SwipeDockDirection
  layout: "mobile" | "desktop"
  children: ReactNode
}) {
  if (layout === "mobile") {
    return (
      <span className="max-w-full truncate text-[8px] font-bold uppercase tracking-[0.1em] leading-none">
        {children}
      </span>
    )
  }

  return (
    <span className="flex flex-col items-center gap-0.5 leading-none">
      {direction ? (
        <span className="text-[11px] font-black leading-none opacity-95 sm:hidden" aria-hidden>
          {DIRECTION_GLYPH[direction]}
        </span>
      ) : null}
      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] sm:text-[10px]">
        {children}
      </span>
    </span>
  )
}

type Props = {
  busy: boolean
  deckEmpty: boolean
  canUndo: boolean
  onSwipe: (direction: BuyerSwipeDirection) => void
  onUndo: () => void
}

/** Mobile: tactile icons only (no keyboard glyphs). Desktop keeps ↑←→↓ hints. */
export function SwipeCommerceDock({ busy, deckEmpty, canUndo, onSwipe, onUndo }: Props) {
  const t = useTranslations("pulse.commerce")
  const disabled = busy || deckEmpty

  return (
    <div
      data-testid="pulse-swipe-dock"
      className={cn(
        affisellBrand.epoxyPanel,
        "affisell-swipe-dock affisell-swipe-dock-panel relative z-50 mx-auto w-full max-w-[380px] shrink-0 px-2 py-1.5 sm:px-4 sm:py-3 lg:max-w-none",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="relative mx-auto sm:hidden">
        <div
          className="pointer-events-none absolute inset-x-[10%] top-[20%] h-px bg-gradient-to-r from-transparent via-violet-300/30 to-transparent"
          aria-hidden
        />
        {/* Next · Cart · Undo · Buy · Save — thumb-friendly, no keyboard clutter */}
        <div className="grid grid-cols-5 items-stretch gap-1.5">
          <DockButton
            layout="mobile"
            direction="left"
            label={t("skipShort")}
            ariaLabel={t("skip")}
            icon={ChevronLeft}
            disabled={disabled}
            onClick={() => onSwipe("left")}
          />
          <DockButton
            layout="mobile"
            direction="up"
            label={t("cartShort")}
            ariaLabel={t("cart")}
            icon={ShoppingBag}
            variant="cart"
            disabled={disabled}
            onClick={() => onSwipe("up")}
          />
          <DockButton
            layout="mobile"
            label={t("undoShort")}
            ariaLabel={t("undo")}
            icon={RotateCcw}
            disabled={!canUndo || busy}
            onClick={onUndo}
          />
          <DockButton
            layout="mobile"
            direction="right"
            label={t("buyShort")}
            ariaLabel={t("buy")}
            icon={Zap}
            variant="buy"
            disabled={disabled}
            onClick={() => onSwipe("right")}
          />
          <DockButton
            layout="mobile"
            direction="down"
            label={t("saveDropShort")}
            ariaLabel={t("saveDrop")}
            icon={Bookmark}
            variant="drop"
            disabled={disabled}
            onClick={() => onSwipe("down")}
          />
        </div>
      </div>

      <p className="mb-1.5 hidden text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:mb-2 sm:block">
        {t("hint")}
      </p>
      <div className="hidden grid-cols-5 gap-2 sm:grid">
        <DockButton
          direction="left"
          label={t("skipShort")}
          ariaLabel={t("skip")}
          icon={ChevronLeft}
          disabled={disabled}
          onClick={() => onSwipe("left")}
        />
        <DockButton
          direction="up"
          label={t("cartShort")}
          ariaLabel={t("cart")}
          icon={ShoppingBag}
          variant="cart"
          disabled={disabled}
          onClick={() => onSwipe("up")}
        />
        <DockButton
          label={t("undoShort")}
          ariaLabel={t("undo")}
          icon={RotateCcw}
          disabled={!canUndo || busy}
          onClick={onUndo}
        />
        <DockButton
          direction="right"
          label={t("buyShort")}
          ariaLabel={t("buy")}
          icon={Zap}
          variant="buy"
          disabled={disabled}
          onClick={() => onSwipe("right")}
        />
        <DockButton
          direction="down"
          label={t("saveDropShort")}
          ariaLabel={t("saveDrop")}
          icon={Bookmark}
          variant="drop"
          disabled={disabled}
          onClick={() => onSwipe("down")}
        />
      </div>
    </div>
  )
}
