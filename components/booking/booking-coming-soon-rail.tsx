"use client"

import { CalendarClock, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { isBookableListingKind } from "@/lib/booking/types"
import { cn } from "@/lib/utils"

type Props = {
  listingKind: string
  className?: string
}

export function BookingComingSoonRail({ listingKind, className }: Props) {
  const t = useTranslations("Product.booking")
  if (!isBookableListingKind(listingKind)) return null

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-cyan-950/95 via-slate-950 to-violet-950 p-5 text-white shadow-[0_0_60px_-24px_rgba(6,182,212,0.55)]",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl" aria-hidden />
      <div className="relative flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <CalendarClock className="h-5 w-5 text-cyan-200" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
            <Sparkles className="h-3 w-3 text-amber-300" aria-hidden />
            {t("comingSoonBadge")}
          </p>
          <p className="mt-2 text-sm font-semibold text-white">{t("comingSoonTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-cyan-100/85">{t("comingSoonBody")}</p>
        </div>
      </div>
    </div>
  )
}
