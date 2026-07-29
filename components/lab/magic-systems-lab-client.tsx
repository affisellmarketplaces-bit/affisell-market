"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { ArrowUpRight, Sparkles } from "lucide-react"

import {
  filterMagicSystems,
  magicSystemsFiltersForRole,
  magicSystemsForRole,
  type MagicSystemEntry,
  type MagicSystemsFilter,
} from "@/lib/magic-systems-catalog"
import { cn } from "@/lib/utils"

const ACCENT: Record<MagicSystemEntry["accent"], string> = {
  violet: "from-violet-500/25 via-transparent to-fuchsia-500/10 border-violet-400/30",
  emerald: "from-emerald-500/20 via-transparent to-teal-500/10 border-emerald-400/30",
  cyan: "from-cyan-500/20 via-transparent to-sky-500/10 border-cyan-400/30",
  amber: "from-amber-500/20 via-transparent to-orange-500/10 border-amber-400/30",
  rose: "from-rose-500/20 via-transparent to-pink-500/10 border-rose-400/30",
  sky: "from-sky-500/20 via-transparent to-indigo-500/10 border-sky-400/30",
}

const STATUS_CLASS: Record<MagicSystemEntry["status"], string> = {
  live: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30",
  beta: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
  new: "bg-fuchsia-500/25 text-fuchsia-50 ring-fuchsia-400/40",
}

function LabSkeleton() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14" aria-busy>
      <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-12 w-72 max-w-full animate-pulse rounded-lg bg-white/10" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ))}
      </div>
    </div>
  )
}

export function MagicSystemsLabClient() {
  const t = useTranslations("magicSystems")
  const { data: session, status } = useSession()
  const role = session?.user?.role

  const roleCatalog = useMemo(() => magicSystemsForRole(role), [role])
  const filters = useMemo(() => magicSystemsFiltersForRole(role), [role])

  const defaultFilter: MagicSystemsFilter =
    role === "SUPPLIER" || role === "ADMIN"
      ? "supplier"
      : role === "AFFILIATE"
        ? "affiliate"
        : "buyer"

  const [filter, setFilter] = useState<MagicSystemsFilter>(defaultFilter)

  useEffect(() => {
    setFilter(defaultFilter)
  }, [defaultFilter])

  const entries = useMemo(() => {
    if (filter === "all") return roleCatalog
    const scoped = filterMagicSystems(filter, roleCatalog)
    return scoped.length > 0 ? scoped : roleCatalog
  }, [filter, roleCatalog])

  if (status === "loading") {
    return <LabSkeleton />
  }

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300/90">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-3 bg-gradient-to-br from-white via-violet-100 to-cyan-200 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl sm:leading-none"
          style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}
        >
          {t("title")}
        </h1>
        <p className="mt-4 text-pretty text-base text-violet-100/85 sm:text-lg">{t("subtitle")}</p>
      </header>

      {filters.length > 1 ? (
        <div
          className="mt-8 flex flex-wrap gap-2"
          role="tablist"
          aria-label={t("filtersAria")}
        >
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                filter === f
                  ? "border-white/30 bg-white text-zinc-950"
                  : "border-white/12 bg-white/5 text-zinc-200 hover:border-violet-400/40 hover:bg-violet-500/15"
              )}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      ) : null}

      <ul
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
          filters.length > 1 ? "mt-10" : "mt-8"
        )}
      >
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={entry.href}
              prefetch={false}
              className={cn(
                "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-md transition",
                "hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_20px_50px_rgb(5_8_22_/_0.45)]",
                ACCENT[entry.accent]
              )}
              data-testid={`magic-system-${entry.id}`}
              data-persona={entry.persona}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ring-1",
                    STATUS_CLASS[entry.status]
                  )}
                >
                  {t(`status.${entry.status}`)}
                </span>
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">
                  {t(`filters.${entry.persona}`)}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-bold tracking-tight text-white">
                {t(`entries.${entry.titleKey}.title`)}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/65">
                {t(`entries.${entry.blurbKey}.blurb`)}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-100 transition group-hover:text-white">
                {t("open")}
                <ArrowUpRight className="size-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {entries.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-400">{t("empty")}</p>
      ) : null}

      <p className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
        <Sparkles className="size-3.5 text-violet-400/80" aria-hidden />
        {t("footerHint", { count: roleCatalog.length })}
      </p>
    </div>
  )
}
