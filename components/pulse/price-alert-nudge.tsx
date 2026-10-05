"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BellRing, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useState } from "react"

import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

/** How long the offer stays on screen if the visitor ignores it (paused while they interact with it). */
const AUTO_DISMISS_MS = 12_000

export type PriceAlertNudgeCloseReason = "later" | "timeout" | "signUp" | "signIn"

type Props = {
  open: boolean
  productTitle: string
  /** Already formatted in the visitor's currency, e.g. "€14.43". */
  targetPriceLabel: string
  onSignUp: () => void
  onSignIn: () => void
  /** `later` = explicit "not now" (counts against showing it again); `timeout` = they just kept swiping. */
  onClose: (reason: Extract<PriceAlertNudgeCloseReason, "later" | "timeout">) => void
}

/**
 * Non-blocking offer shown right after a guest saves a product on Pulse: the favourite is already kept — this only asks
 * whether they want the price-drop alert, and never takes them out of the feed unless they say yes.
 */
export function PriceAlertNudge({ open, productTitle, targetPriceLabel, onSignUp, onSignIn, onClose }: Props) {
  const t = useTranslations("pulse.commerce.priceNudge")
  const reducedMotion = useReducedMotion()
  const titleId = useId()
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose("later")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || paused) return
    const timer = window.setTimeout(() => onClose("timeout"), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [open, paused, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.section
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          data-testid="pulse-price-alert-nudge"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-[170] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
        >
          <div
            className={cn(
              affisellBrand.epoxyPanel,
              "relative mx-auto w-full max-w-[420px] overflow-hidden border border-cyan-300/25 p-4 shadow-[0_-12px_48px_rgb(6_182_212_/_0.18)]"
            )}
          >
            <span
              className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-cyan-400/20 blur-2xl"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => onClose("later")}
              aria-label={t("closeAria")}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              <X className="size-4" aria-hidden />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30">
                <BellRing className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="text-sm font-semibold leading-snug text-white">
                  {t("title")}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">{t("body", { price: targetPriceLabel })}</p>
                {productTitle ? (
                  <p className="mt-1.5 truncate text-[11px] font-medium text-cyan-200/80">{productTitle}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSignUp}
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/20 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                {t("signUp")}
              </button>
              <button
                type="button"
                onClick={() => onClose("later")}
                className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-medium text-zinc-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                {t("later")}
              </button>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              className="mt-1 w-full py-1.5 text-center text-xs text-zinc-400 underline-offset-2 transition hover:text-zinc-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              {t("signIn")}
            </button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  )
}
