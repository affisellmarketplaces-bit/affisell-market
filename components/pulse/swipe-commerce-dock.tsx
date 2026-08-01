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
import { cn } from "@/lib/utils"

type SwipeDockDirection = BuyerSwipeDirection

const DIRECTION_GLYPH: Record<SwipeDockDirection, string> = {
  up: "↑",
  left: "←",
  right: "→",
  down: "↓",
}

type DockTone = "skip" | "cart" | "undo" | "buy" | "save"

type DockButtonProps = {
  direction?: SwipeDockDirection
  label: string
  ariaLabel: string
  icon: LucideIcon
  tone: DockTone
  disabled?: boolean
  onClick: () => void
  layout?: "mobile" | "desktop"
}

function DockButton({
  direction,
  label,
  ariaLabel,
  icon: Icon,
  tone,
  disabled,
  onClick,
  layout = "desktop",
}: DockButtonProps) {
  const mobile = layout === "mobile"
  const primary = tone === "buy"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={direction ? `pulse-swipe-dock-${direction}` : "pulse-swipe-dock-undo"}
      data-tone={tone}
      className={cn(
        "pulse-hud-pad group relative isolate touch-manipulation overflow-hidden",
        "flex flex-col items-center justify-center",
        "transition-[transform,box-shadow,filter,background-color] duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]",
        "active:scale-[0.94] disabled:pointer-events-none disabled:opacity-35",
        mobile
          ? cn(
              "min-h-0 gap-1 rounded-[1.15rem] px-0.5 py-1.5",
              primary ? "pulse-hud-pad--buy min-h-[3.25rem] rounded-[1.35rem]" : "aspect-square"
            )
          : cn(
              "min-h-[3rem] w-full gap-1 rounded-2xl px-1 py-2.5",
              primary && "pulse-hud-pad--buy min-h-[3.5rem]"
            ),
        `pulse-hud-pad--${tone}`
      )}
    >
      <span className="pulse-hud-pad__sheen" aria-hidden />
      <span
        className={cn(
          "pulse-hud-pad__icon relative z-[1] grid place-items-center rounded-full",
          primary ? "size-8 sm:size-9" : "size-7 sm:size-8"
        )}
      >
        <Icon
          className={cn("shrink-0", primary ? "size-[1.15rem] sm:size-5" : "size-4 sm:size-[1.05rem]")}
          strokeWidth={primary ? 2.35 : 2.1}
          aria-hidden
        />
      </span>
      <DockActionLabel direction={direction} layout={layout} emphasis={primary}>
        {label}
      </DockActionLabel>
      {primary ? <span className="pulse-hud-pad__pulse" aria-hidden /> : null}
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
          "relative z-[1] max-w-full truncate uppercase leading-none tracking-[0.14em]",
          emphasis ? "text-[9px] font-black text-white" : "text-[7.5px] font-bold text-white/88"
        )}
      >
        {children}
      </span>
    )
  }

  return (
    <span className="relative z-[1] flex flex-col items-center gap-0.5 leading-none">
      {direction ? (
        <span className="text-[10px] font-black leading-none text-white/70 lg:hidden" aria-hidden>
          {DIRECTION_GLYPH[direction]}
        </span>
      ) : null}
      <span
        className={cn(
          "uppercase tracking-[0.14em]",
          emphasis ? "text-[10px] font-black text-white sm:text-[11px]" : "text-[8px] font-bold text-white/85 sm:text-[10px]"
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

/** Same 5 actions — HUD pads. Mobile: tactile. Desktop (lg+): + keyboard hint strip. */
export function SwipeCommerceDock({ busy, deckEmpty, canUndo, onSwipe, onUndo }: Props) {
  const t = useTranslations("pulse.commerce")
  const disabled = busy || deckEmpty

  const pads = (
    <>
      <DockButton
        direction="left"
        label={t("skipShort")}
        ariaLabel={t("skip")}
        icon={ChevronLeft}
        tone="skip"
        disabled={disabled}
        onClick={() => onSwipe("left")}
      />
      <DockButton
        direction="up"
        label={t("cartShort")}
        ariaLabel={t("cart")}
        icon={ShoppingBag}
        tone="cart"
        disabled={disabled}
        onClick={() => onSwipe("up")}
      />
      <DockButton
        label={t("undoShort")}
        ariaLabel={t("undo")}
        icon={RotateCcw}
        tone="undo"
        disabled={!canUndo || busy}
        onClick={onUndo}
      />
      <DockButton
        direction="right"
        label={t("buyShort")}
        ariaLabel={t("buy")}
        icon={Zap}
        tone="buy"
        disabled={disabled}
        onClick={() => onSwipe("right")}
      />
      <DockButton
        direction="down"
        label={t("saveDropShort")}
        ariaLabel={t("saveDrop")}
        icon={Bookmark}
        tone="save"
        disabled={disabled}
        onClick={() => onSwipe("down")}
      />
    </>
  )

  return (
    <div
      data-testid="pulse-swipe-dock"
      className={cn(
        "affisell-swipe-dock affisell-swipe-dock-panel pulse-command-deck pulse-hud-deck relative z-50 mx-auto w-full max-w-[min(100%,400px)] shrink-0",
        "px-1.5 py-1 sm:max-w-[440px] sm:px-2.5 sm:py-1.5 lg:max-w-none lg:px-4 lg:py-3",
        "pb-[max(0.3rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="pulse-hud-deck__rim" aria-hidden />
      <div className="pulse-hud-deck__channel relative">
        <p className="mb-1 px-1 text-center text-[9px] font-medium uppercase tracking-[0.16em] text-cyan-200/40 sm:mb-1.5 sm:text-[10px] sm:tracking-[0.22em]">
          {t("hint")}
        </p>
        <div className="relative mx-auto lg:hidden">
          <div className="pulse-command-deck__grid pulse-hud-deck__grid grid grid-cols-[0.88fr_0.92fr_0.82fr_1.28fr_0.92fr] items-end gap-1 sm:gap-1.5">
            {/* clone with mobile layout */}
            <DockButton
              layout="mobile"
              direction="left"
              label={t("skipShort")}
              ariaLabel={t("skip")}
              icon={ChevronLeft}
              tone="skip"
              disabled={disabled}
              onClick={() => onSwipe("left")}
            />
            <DockButton
              layout="mobile"
              direction="up"
              label={t("cartShort")}
              ariaLabel={t("cart")}
              icon={ShoppingBag}
              tone="cart"
              disabled={disabled}
              onClick={() => onSwipe("up")}
            />
            <DockButton
              layout="mobile"
              label={t("undoShort")}
              ariaLabel={t("undo")}
              icon={RotateCcw}
              tone="undo"
              disabled={!canUndo || busy}
              onClick={onUndo}
            />
            <DockButton
              layout="mobile"
              direction="right"
              label={t("buyShort")}
              ariaLabel={t("buy")}
              icon={Zap}
              tone="buy"
              disabled={disabled}
              onClick={() => onSwipe("right")}
            />
            <DockButton
              layout="mobile"
              direction="down"
              label={t("saveDropShort")}
              ariaLabel={t("saveDrop")}
              icon={Bookmark}
              tone="save"
              disabled={disabled}
              onClick={() => onSwipe("down")}
            />
          </div>
        </div>

        <div className="pulse-command-deck__grid pulse-hud-deck__grid hidden grid-cols-[0.9fr_1fr_0.85fr_1.35fr_1fr] items-end gap-2 lg:grid">
          {pads}
        </div>
      </div>
    </div>
  )
}
