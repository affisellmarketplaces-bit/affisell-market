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
  prominence?: "ghost" | "secondary" | "primary"
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
  prominence = "secondary",
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
  const primary = prominence === "primary"
  const ghost = prominence === "ghost"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={direction ? `pulse-swipe-dock-${direction}` : "pulse-swipe-dock-undo"}
      className={cn(
        shell,
        "pulse-dock-btn touch-manipulation transition-[transform,box-shadow,filter] duration-200 ease-out active:scale-[0.96]",
        mobile
          ? cn(
              "flex min-h-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1",
              primary
                ? "aspect-auto min-h-[3.55rem] rounded-[1.25rem] shadow-[0_0_36px_-4px_rgba(34,211,238,0.7)]"
                : "aspect-square",
              ghost && "opacity-80"
            )
          : cn(
              "min-h-[2.75rem] w-full gap-1 px-1 py-2 sm:min-h-0 sm:gap-0.5 sm:py-2.5",
              primary && "sm:min-h-[3.25rem] sm:shadow-[0_0_32px_-6px_rgba(34,211,238,0.55)]"
            ),
        primary && "pulse-dock-btn--primary",
        ghost && "pulse-dock-btn--ghost",
        className
      )}
    >
      <Icon
        className={cn(
          "shrink-0",
          mobile
            ? primary
              ? "size-[1.35rem]"
              : "size-[1.1rem]"
            : primary
              ? "size-5 sm:size-[1.35rem]"
              : "size-[18px] sm:size-5"
        )}
        aria-hidden
      />
      <DockActionLabel direction={direction} layout={layout} emphasis={primary}>
        {label}
      </DockActionLabel>
    </button>
  )
}

function DockActionLabel({
  direction,
  layout,
  children,
  emphasis = false,
}: {
  direction?: SwipeDockDirection
  layout: "mobile" | "desktop"
  children: ReactNode
  emphasis?: boolean
}) {
  if (layout === "mobile") {
    return (
      <span
        className={cn(
          "max-w-full truncate uppercase leading-none tracking-[0.12em]",
          emphasis ? "text-[9px] font-black" : "text-[8px] font-bold"
        )}
      >
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
      <span
        className={cn(
          "uppercase tracking-[0.1em]",
          emphasis ? "text-[9px] font-black sm:text-[11px]" : "text-[8px] font-semibold sm:text-[10px]"
        )}
      >
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
        "affisell-swipe-dock affisell-swipe-dock-panel pulse-command-deck relative z-50 mx-auto w-full max-w-[380px] shrink-0 px-2 py-1.5 sm:px-4 sm:py-3 lg:max-w-none",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="relative mx-auto sm:hidden">
        <div className="pulse-command-deck__horizon" aria-hidden />
        {/* Skip · Cart · Undo · Buy · Save — Buy is the primary conversion node */}
        <div className="pulse-command-deck__grid grid grid-cols-[0.9fr_0.95fr_0.85fr_1.35fr_0.95fr] items-end gap-1.5">
          <DockButton
            layout="mobile"
            direction="left"
            label={t("skipShort")}
            ariaLabel={t("skip")}
            icon={ChevronLeft}
            prominence="ghost"
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
            prominence="ghost"
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
            prominence="primary"
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

      <p className="mb-1.5 hidden text-center text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-200/45 sm:mb-2 sm:block">
        {t("hint")}
      </p>
      <div className="pulse-command-deck__grid hidden grid-cols-[0.9fr_1fr_0.85fr_1.4fr_1fr] items-end gap-2 sm:grid">
        <DockButton
          direction="left"
          label={t("skipShort")}
          ariaLabel={t("skip")}
          icon={ChevronLeft}
          prominence="ghost"
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
          prominence="ghost"
          disabled={!canUndo || busy}
          onClick={onUndo}
        />
        <DockButton
          direction="right"
          label={t("buyShort")}
          ariaLabel={t("buy")}
          icon={Zap}
          variant="buy"
          prominence="primary"
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
