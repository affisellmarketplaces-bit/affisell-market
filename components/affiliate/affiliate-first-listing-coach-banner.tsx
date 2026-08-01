"use client"

import { ArrowRight, Sparkles, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import {
  readCoachDismissed,
  writeCoachDismissed,
} from "@/lib/affisell-coach-storage"
import { cn } from "@/lib/utils"

const SURFACE = "affiliateFirstListing"
const VERSION = "v1"

type Props = {
  className?: string
  /** Force show (e.g. ?onboarding=1), ignoring prior dismiss. */
  force?: boolean
}

/** Swipe hub coach — first listing in ~5 minutes. Dismissible via localStorage. */
export function AffiliateFirstListingCoachBanner({ className, force = false }: Props) {
  const t = useTranslations("affiliateDashboard.firstListing")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (force) {
      setOpen(true)
      return
    }
    setOpen(!readCoachDismissed(SURFACE, VERSION))
  }, [force])

  useEffect(() => {
    if (!open) return
    console.log("[coach]", { surface: SURFACE, result: "shown" })
  }, [open])

  function dismiss() {
    writeCoachDismissed(SURFACE, VERSION)
    console.log("[coach]", { surface: SURFACE, result: "dismissed" })
    setOpen(false)
  }

  if (!open) return null

  return (
    <section
      data-testid="affiliate-first-listing-coach"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-600/10 via-white to-fuchsia-50/60 p-4 shadow-sm dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/20 sm:p-5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-fuchsia-400/20 blur-2xl"
        aria-hidden
      />
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 z-[1] rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label={t("dismiss")}
        data-testid="affiliate-first-listing-coach-dismiss"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 pr-8">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
            <Sparkles className="size-3.5" aria-hidden />
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 text-base font-bold text-zinc-900 dark:text-white sm:text-lg">{t("title")}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("body")}</p>
          <ol className="mt-3 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <li className="flex items-center gap-2">
              <ArrowRight className="size-4 shrink-0 text-violet-600" aria-hidden />
              {t("stepSwipe")}
            </li>
            <li>{t("stepPrice")}</li>
            <li>{t("stepPublish")}</li>
          </ol>
          <p className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2 text-[11px] leading-snug text-cyan-900/80 dark:text-cyan-100/80">
            {t("buyerContrast")}
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-500 active:scale-[0.98]"
          >
            {t("ctaGotIt")}
          </button>
        </div>
      </div>
    </section>
  )
}
