"use client"

import { useTranslations } from "next-intl"

import { TriDashHandle } from "@/components/ui/tri-dash-handle"
import { cn } from "@/lib/utils"

type Props = {
  onOpen: () => void
  className?: string
}

/** Slim sticky rail after “close all” — three dashes restore the aisle column. */
export function CatalogCategoryDockRail({ onOpen, className }: Props) {
  const t = useTranslations("marketplace.sidebar")

  return (
    <aside
      className={cn(
        "hidden shrink-0 lg:sticky lg:top-[5.25rem] lg:flex lg:self-start",
        className
      )}
    >
      <div
        className={cn(
          "affisell-category-dock-rail relative flex w-12 flex-col items-center overflow-hidden rounded-2xl border border-violet-400/35",
          "bg-gradient-to-b from-violet-700 via-indigo-800 to-violet-950 py-3 shadow-lg shadow-violet-900/25"
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.18),transparent_55%)]" aria-hidden />
        <TriDashHandle
          size="rail"
          expanded={false}
          onClick={onOpen}
          label={t("showCategoryColumn")}
          className="relative z-10 text-white"
        />
        <span
          className="relative z-10 mt-3 max-h-28 origin-center rotate-180 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-100/85 [writing-mode:vertical-rl]"
          aria-hidden
        >
          {t("title")}
        </span>
      </div>
    </aside>
  )
}
