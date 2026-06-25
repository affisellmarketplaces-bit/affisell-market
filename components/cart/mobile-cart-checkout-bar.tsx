"use client"

import { Loader2, Sparkles } from "lucide-react"

import { AFFISELL_MOBILE_STICKY_ABOVE_DOCK } from "@/lib/mobile-chrome"
import { cn } from "@/lib/utils"

type Props = {
  totalLabel: string
  totalFormatted: string
  ctaLabel: string
  busyLabel: string
  disabled: boolean
  busy: boolean
  onCheckout: () => void
}

/** Thumb-zone checkout — fixed above mobile dock, safe-area aware. */
export function MobileCartCheckoutBar({
  totalLabel,
  totalFormatted,
  ctaLabel,
  busyLabel,
  disabled,
  busy,
  onCheckout,
}: Props) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-[90] md:hidden",
        "border-t border-violet-500/25 bg-white/95 backdrop-blur-xl dark:bg-zinc-950/95",
        "shadow-[0_-16px_48px_-24px_rgba(124,58,237,0.45)]"
      )}
      style={{ bottom: AFFISELL_MOBILE_STICKY_ABOVE_DOCK }}
    >
      <div
        className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3"
        style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {totalLabel}
          </p>
          <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{totalFormatted}</p>
        </div>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onCheckout}
          className={cn(
            "inline-flex h-12 min-w-[9.5rem] shrink-0 touch-manipulation items-center justify-center gap-2 rounded-2xl px-5",
            "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-semibold text-white shadow-lg",
            "transition active:scale-[0.98] disabled:opacity-55"
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {busyLabel}
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              {ctaLabel}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
