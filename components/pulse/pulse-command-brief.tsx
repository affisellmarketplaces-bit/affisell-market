"use client"

import {
  Bookmark,
  ChevronLeft,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  coachStorageKey,
  readCoachDismissed,
  writeCoachDismissed,
} from "@/lib/affisell-coach-storage"
import { cn } from "@/lib/utils"

const SURFACE = "buyerPulse"
const VERSION = "v1"

type Pad = {
  icon: typeof Zap
  labelKey: "padPass" | "padCart" | "padUndo" | "padBuy" | "padWish"
  tone: string
}

const PADS: Pad[] = [
  { icon: ChevronLeft, labelKey: "padPass", tone: "text-slate-200" },
  { icon: ShoppingBag, labelKey: "padCart", tone: "text-emerald-200" },
  { icon: RotateCcw, labelKey: "padUndo", tone: "text-slate-300" },
  { icon: Zap, labelKey: "padBuy", tone: "text-cyan-100" },
  { icon: Bookmark, labelKey: "padWish", tone: "text-amber-100" },
]

type Props = {
  open: boolean
  onDismiss: () => void
}

/**
 * First-run Command Brief for buyer Pulse — teaches the 5 HUD pads without
 * wrapping e2e dock targets (sibling overlay only).
 */
export function PulseCommandBrief({ open, onDismiss }: Props) {
  const t = useTranslations("pulse.commerce.coach")

  function dismiss() {
    writeCoachDismissed(SURFACE, VERSION)
    console.log("[coach]", { surface: SURFACE, result: "dismissed" })
    onDismiss()
  }

  useEffect(() => {
    if (!open) return
    console.log("[coach]", { surface: SURFACE, result: "shown" })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[80] flex items-end justify-center px-3 pb-[calc(var(--affisell-swipe-dock-h)+0.75rem)] pt-16 sm:items-center sm:pb-8 sm:pt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          data-testid="pulse-command-brief"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pulse-command-brief-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#020617]/72 backdrop-blur-[2px]"
            aria-label={t("dismiss")}
            onClick={dismiss}
          />
          <motion.div
            className={cn(
              "pulse-command-brief relative z-[1] w-full max-w-[22rem] overflow-hidden rounded-[1.5rem]",
              "border border-cyan-300/25 bg-[#070b14]/92 p-4 shadow-[0_24px_64px_rgb(2_6_23_/_0.65)] sm:p-5"
            )}
            initial={{ y: 28, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-cyan-400/15 blur-3xl"
              aria-hidden
            />
            <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">
              <Sparkles className="size-3.5" aria-hidden />
              {t("eyebrow")}
            </p>
            <h2
              id="pulse-command-brief-title"
              className="relative mt-1.5 text-lg font-semibold tracking-tight text-white"
            >
              {t("title")}
            </h2>
            <p className="relative mt-1.5 text-[13px] leading-relaxed text-white/65">{t("body")}</p>

            <ul className="relative mt-4 space-y-2">
              {PADS.map((pad) => {
                const Icon = pad.icon
                return (
                  <li
                    key={pad.labelKey}
                    className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/5 ring-1 ring-white/10",
                        pad.tone
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 text-[12px] leading-snug text-white/85">
                      {t(pad.labelKey)}
                    </span>
                  </li>
                )
              })}
            </ul>

            <p className="relative mt-3 text-[11px] leading-snug text-cyan-100/45">{t("footnote")}</p>

            <button
              type="button"
              onClick={dismiss}
              className={cn(
                "relative mt-4 flex w-full items-center justify-center rounded-xl px-4 py-3",
                "bg-gradient-to-r from-cyan-500 to-teal-500 text-sm font-bold text-white",
                "shadow-[0_12px_32px_rgb(6_182_212_/_0.4)] transition active:scale-[0.98]"
              )}
              data-testid="pulse-command-brief-dismiss"
            >
              {t("cta")}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Hydration-safe gate: wait until mount before reading localStorage. */
export function usePulseCommandBriefGate(opts: { force?: boolean; suppress?: boolean }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (opts.suppress) {
      setOpen(false)
      return
    }
    if (opts.force) {
      setOpen(true)
      return
    }
    setOpen(!readCoachDismissed(SURFACE, VERSION))
  }, [opts.force, opts.suppress])

  return {
    open,
    dismiss: () => setOpen(false),
    storageKey: coachStorageKey(SURFACE, VERSION),
  }
}
