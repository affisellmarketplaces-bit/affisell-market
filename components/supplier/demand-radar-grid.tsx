"use client"

import { Radar, Sparkles, Target } from "lucide-react"
import { useTranslations } from "next-intl"

import type { DemandRadarCategory } from "@/lib/supplier/load-auto-buy-pilot"
import type { DemandBasketBand } from "@/lib/supplier/demand-radar-shared"
import type { DemandPulseTier } from "@/lib/supplier-opportunity-pulse-shared"
import { cn } from "@/lib/utils"

type Props = {
  categories: DemandRadarCategory[]
  windowDays: number
}

const TIER_STYLES: Record<
  DemandPulseTier,
  { badge: string; ring: string; bar: string; glow?: boolean }
> = {
  scan: {
    badge: "border-zinc-400/25 bg-zinc-500/10 text-zinc-300",
    ring: "from-zinc-500/20 to-transparent",
    bar: "bg-zinc-400/70",
  },
  warm: {
    badge: "border-sky-400/25 bg-sky-500/10 text-sky-200",
    ring: "from-sky-400/25 to-transparent",
    bar: "bg-sky-400/80",
  },
  hot: {
    badge: "border-amber-400/30 bg-amber-500/12 text-amber-200",
    ring: "from-amber-400/30 to-transparent",
    bar: "bg-amber-400/85",
  },
  surge: {
    badge: "border-violet-400/35 bg-violet-500/15 text-violet-100",
    ring: "from-violet-400/40 to-cyan-400/10",
    bar: "bg-gradient-to-r from-violet-400 to-cyan-400",
    glow: true,
  },
}

const BASKET_BAND_INDEX: Record<DemandBasketBand, number> = {
  entry: 0,
  core: 1,
  premium: 2,
  luxury: 3,
}

function BasketSignal({
  band,
  label,
  signalLabel,
}: {
  band: DemandBasketBand
  label: string
  signalLabel: string
}) {
  const activeIndex = BASKET_BAND_INDEX[band]
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {signalLabel}
      </span>
      <div className="flex gap-1" aria-hidden>
        {(["entry", "core", "premium", "luxury"] as const).map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-1.5 w-3 rounded-full transition-colors",
              index <= activeIndex ? "bg-violet-400/75" : "bg-white/10"
            )}
          />
        ))}
      </div>
    </div>
  )
}

function DemandRadarCard({ category }: { category: DemandRadarCategory }) {
  const t = useTranslations("supplierDashboard.autoBuyPilot.radar")
  const tier = category.pulse.tier
  const styles = TIER_STYLES[tier]

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3.5",
        "transition duration-300 hover:border-white/20 hover:bg-white/[0.06]",
        styles.glow && "hover:shadow-[0_0_28px_rgba(139,92,246,0.12)]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-90",
          styles.ring
        )}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-white">{category.name}</p>
          <p className="mt-1 text-[11px] tabular-nums text-zinc-400">
            {t("orders", { count: category.orders30d })}
            <span className="mx-1.5 text-zinc-600">·</span>
            {t("networkShare", { pct: category.pulse.networkSharePct })}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
            styles.badge,
            styles.glow && "shadow-[0_0_12px_rgba(139,92,246,0.2)]"
          )}
        >
          {styles.glow ? <Sparkles className="size-2.5" aria-hidden /> : null}
          {t(`tier.${tier}`)}
        </span>
      </div>

      <div className="relative mt-3 space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t("pulseIndex")}
            </p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-white">
              {category.pulse.score}
              <span className="ml-0.5 text-sm font-medium text-zinc-500">/100</span>
            </p>
          </div>
          <p className="text-[10px] font-medium text-zinc-500">
            #{category.pulse.rank}
          </p>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="presentation">
          <div
            className={cn("h-full rounded-full transition-all duration-500", styles.bar)}
            style={{ width: `${category.pulse.score}%` }}
          />
        </div>

        <BasketSignal
          band={category.pulse.basketBand}
          label={t(`basketBand.${category.pulse.basketBand}`)}
          signalLabel={t("basketSignal")}
        />
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            category.supplierHasListing
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
              : "border-violet-400/40 bg-violet-500/20 text-violet-200"
          )}
        >
          {category.supplierHasListing ? t("covered") : t("opportunity")}
        </span>
        {!category.supplierHasListing ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-300/80">
            <Target className="size-3" aria-hidden />
            {t("sourceHint")}
          </span>
        ) : null}
      </div>
    </li>
  )
}

/** Supplier-safe demand radar — no affiliate resale price exposed. */
export function DemandRadarGrid({ categories, windowDays }: Props) {
  const t = useTranslations("supplierDashboard.autoBuyPilot.radar")

  if (categories.length === 0) return null

  return (
    <div className="relative border-t border-white/10 p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(139,92,246,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.5)_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10">
              <Radar className="h-4 w-4 text-violet-300" aria-hidden />
            </span>
            <h4 className="text-sm font-semibold tracking-tight text-white">
              {t("title", { days: windowDays })}
            </h4>
          </div>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-400">{t("subtitle")}</p>
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          {t("liveFeed")}
        </p>
      </div>

      <ul className="relative mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <DemandRadarCard key={category.categoryId} category={category} />
        ))}
      </ul>
    </div>
  )
}
