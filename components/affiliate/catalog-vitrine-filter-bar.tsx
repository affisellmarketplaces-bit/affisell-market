"use client"

import { Check, Filter, Store } from "lucide-react"
import { useTranslations } from "next-intl"

import type { CatalogVitrineFilter } from "@/lib/affiliate-catalog-filters-shared"
import { cn } from "@/lib/utils"

type Props = {
  vitrineFilter: CatalogVitrineFilter
  onChange: (next: CatalogVitrineFilter) => void
}

type ChipProps = {
  active: boolean
  onClick: () => void
  icon: typeof Filter
  title: string
  subtitle: string
  activeHint: string
  inactiveHint: string
  accent: "violet" | "emerald"
}

function VitrineFilterChip({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  activeHint,
  inactiveHint,
  accent,
}: ChipProps) {
  const activeGradient =
    accent === "emerald"
      ? "border-emerald-500/60 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/40"
      : "border-violet-500/60 bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 ring-1 ring-violet-400/40"

  const idleGradient =
    accent === "emerald"
      ? "border-emerald-300/70 bg-gradient-to-r from-emerald-50 via-white to-teal-50 text-emerald-950 hover:border-emerald-400 hover:shadow-sm dark:border-emerald-700/50 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-teal-950/30 dark:text-emerald-100"
      : "border-violet-300/70 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 text-violet-950 hover:border-violet-400 hover:shadow-sm dark:border-violet-700/50 dark:from-violet-950/50 dark:via-zinc-950 dark:to-fuchsia-950/30 dark:text-violet-100"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      title={active ? activeHint : inactiveHint}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-3 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-2",
        active ? activeGradient : idleGradient
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-white/20 text-white"
            : accent === "emerald"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
              : "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200"
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold tracking-tight">{title}</span>
        <span
          className={cn(
            "mt-0.5 block text-[11px] leading-snug",
            active
              ? accent === "emerald"
                ? "text-emerald-100/90"
                : "text-violet-100/90"
              : accent === "emerald"
                ? "text-emerald-700/75 dark:text-emerald-300/80"
                : "text-violet-700/75 dark:text-violet-300/80"
          )}
        >
          {subtitle}
        </span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          active
            ? "bg-white/30"
            : accent === "emerald"
              ? "bg-emerald-200 dark:bg-emerald-800"
              : "bg-violet-200 dark:bg-violet-800"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            active ? "left-[1.375rem]" : "left-0.5"
          )}
        />
      </span>
    </button>
  )
}

/** Mutually exclusive storefront filters — `?vitrine=hors` | `?vitrine=en`. */
export function CatalogVitrineFilterBar({ vitrineFilter, onChange }: Props) {
  const t = useTranslations("affiliate.catalogFilters")
  const horsOn = vitrineFilter === "hors"
  const enOn = vitrineFilter === "en"

  return (
    <div
      className="grid gap-2 sm:max-w-2xl sm:grid-cols-2"
      role="group"
      aria-label={t("vitrineGroupAria")}
    >
      <VitrineFilterChip
        active={horsOn}
        accent="violet"
        icon={Filter}
        title={t("notInStoreYet")}
        subtitle={horsOn ? t("notInStoreYetOn") : t("notInStoreYetOff")}
        activeHint={t("horsVitrineOffHint")}
        inactiveHint={t("horsVitrineOnHint")}
        onClick={() => onChange(horsOn ? "all" : "hors")}
      />
      <VitrineFilterChip
        active={enOn}
        accent="emerald"
        icon={enOn ? Check : Store}
        title={t("alreadyInStore")}
        subtitle={enOn ? t("alreadyInStoreOn") : t("alreadyInStoreOff")}
        activeHint={t("enVitrineOffHint")}
        inactiveHint={t("enVitrineOnHint")}
        onClick={() => onChange(enOn ? "all" : "en")}
      />
    </div>
  )
}
