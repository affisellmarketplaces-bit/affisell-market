"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/** Swipe hub coach — first listing in ~5 minutes. */
export function AffiliateFirstListingCoachBanner({ className }: Props) {
  const t = useTranslations("affiliateDashboard.firstListing")

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-600/10 via-white to-fuchsia-50/60 p-4 shadow-sm dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/20 sm:p-5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-fuchsia-400/20 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
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
        </div>
      </div>
    </section>
  )
}
