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
  compact?: boolean
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
  compact = false,
}: DockButtonProps) {
  const shell =
    variant === "buy"
      ? affisellBrand.epoxyActionBuy
      : variant === "cart"
        ? affisellBrand.epoxyActionCart
        : variant === "drop"
          ? affisellBrand.epoxyActionDrop
          : affisellBrand.epoxyActionBtn

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        shell,
        "touch-manipulation",
        "min-h-[2.75rem] w-full gap-1 px-1 py-2 sm:min-h-0 sm:gap-0.5 sm:py-2",
        variant === "buy" && "sm:shadow-lg",
        className
      )}
    >
      <Icon className="size-[18px] shrink-0 sm:size-5" aria-hidden />
      {compact && direction ? (
        <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none">
          <span aria-hidden>{DIRECTION_GLYPH[direction]}</span>
          <span>{label}</span>
        </span>
      ) : (
        <DockActionLabel direction={direction}>{label}</DockActionLabel>
      )}
    </button>
  )
}

function DockActionLabel({
  direction,
  children,
}: {
  direction?: SwipeDockDirection
  children: ReactNode
}) {
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
      className={cn(
        affisellBrand.epoxyPanel,
        "affisell-swipe-dock affisell-swipe-dock-panel relative z-50 mx-auto w-full max-w-[380px] shrink-0 px-2 py-2 sm:px-4 sm:py-3",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="relative mx-auto max-w-[19rem] space-y-1.5 sm:hidden">
        <div
          className="pointer-events-none absolute inset-[12%_6%_22%] flex items-center justify-center"
          aria-hidden
        >
          <div className="absolute h-full w-px bg-gradient-to-b from-emerald-400/0 via-violet-300/35 to-amber-300/0" />
          <div className="absolute h-px w-full bg-gradient-to-r from-white/0 via-violet-300/30 to-white/0" />
          <span className="relative size-1.5 rounded-full bg-violet-300/50 shadow-[0_0_10px_rgba(196,181,253,0.65)]" />
        </div>

        <p className="text-center text-[8px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {t("hint")}
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          <div aria-hidden />
          <DockButton
            compact
            direction="up"
            label={t("cartShort")}
            ariaLabel={t("cart")}
            icon={ShoppingBag}
            variant="cart"
            disabled={disabled}
            onClick={() => onSwipe("up")}
          />
          <div aria-hidden />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <DockButton
            compact
            direction="left"
            label={t("skipShort")}
            ariaLabel={t("skip")}
            icon={ChevronLeft}
            disabled={disabled}
            onClick={() => onSwipe("left")}
          />
          <div className="flex min-h-[2.75rem] items-center justify-center" aria-hidden>
            <span className="size-1 rounded-full bg-white/20" />
          </div>
          <DockButton
            compact
            direction="right"
            label={t("buyShort")}
            ariaLabel={t("buy")}
            icon={Zap}
            variant="buy"
            disabled={disabled}
            onClick={() => onSwipe("right")}
            className="min-h-[3.1rem] shadow-[0_0_22px_-4px_rgba(124,58,237,0.75)]"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div aria-hidden />
          <DockButton
            compact
            direction="down"
            label={t("saveDropShort")}
            ariaLabel={t("saveDrop")}
            icon={Bookmark}
            variant="drop"
            disabled={disabled}
            onClick={() => onSwipe("down")}
          />
          <div aria-hidden />
        </div>

        <DockButton
          label={t("undoShort")}
          ariaLabel={t("undo")}
          icon={RotateCcw}
          disabled={!canUndo || busy}
          onClick={onUndo}
          className="!min-h-[2.35rem] !w-full !flex-row !gap-2 !rounded-full !py-1.5 opacity-90"
        />
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
