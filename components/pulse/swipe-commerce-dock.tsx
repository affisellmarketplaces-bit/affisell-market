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
              "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5",
              variant === "buy" && "min-h-[3.55rem] shadow-[0_0_28px_-6px_rgba(124,58,237,0.85)]"
            )
          : "min-h-[2.75rem] w-full gap-1 px-1 py-2 sm:min-h-0 sm:gap-0.5 sm:py-2",
        variant === "buy" && !mobile && "sm:shadow-lg",
        className
      )}
    >
      {direction && mobile ? (
        <span className="text-[10px] font-black leading-none opacity-90" aria-hidden>
          {DIRECTION_GLYPH[direction]}
        </span>
      ) : null}
      <Icon
        className={cn("shrink-0", mobile ? "size-5" : "size-[18px] sm:size-5")}
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
      <span className="max-w-full truncate text-[8px] font-bold uppercase tracking-[0.12em] leading-none">
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

export function SwipeCommerceDock({ busy, deckEmpty, canUndo, onSwipe, onUndo }: Props) {
  const t = useTranslations("pulse.commerce")
  const disabled = busy || deckEmpty

  return (
    <div
      data-testid="pulse-swipe-dock"
      className={cn(
        affisellBrand.epoxyPanel,
        "affisell-swipe-dock affisell-swipe-dock-panel relative z-50 mx-auto w-full max-w-[380px] shrink-0 px-2 py-2 sm:px-4 sm:py-3",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="relative mx-auto sm:hidden">
        <div
          className="pointer-events-none absolute inset-x-[8%] top-[18%] h-px bg-gradient-to-r from-transparent via-violet-300/35 to-transparent"
          aria-hidden
        />
        <div className="grid grid-cols-[1fr_1.15fr_1fr_1fr_auto] items-stretch gap-1.5">
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
            direction="down"
            label={t("saveDropShort")}
            ariaLabel={t("saveDrop")}
            icon={Bookmark}
            variant="drop"
            disabled={disabled}
            onClick={() => onSwipe("down")}
          />
          <DockButton
            layout="mobile"
            label={t("undoShort")}
            ariaLabel={t("undo")}
            icon={RotateCcw}
            disabled={!canUndo || busy}
            onClick={onUndo}
            className="!min-w-[2.65rem] !rounded-2xl !px-0"
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
