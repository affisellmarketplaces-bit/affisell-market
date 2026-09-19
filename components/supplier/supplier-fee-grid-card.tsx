"use client"

import Link from "next/link"
import { ChevronRight, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { COMMISSION_GRID_MAP } from "@/lib/commission-grid-config"
import { AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS, RESELLER_PLATFORM_FEE_BPS } from "@/lib/money/sale-split"
import { cn } from "@/lib/utils"

const gridBps = Object.values(COMMISSION_GRID_MAP)
  .map((e) => e.affisellBps)
  .filter((b) => b > 0)
const MIN_PCT = Math.min(...gridBps) / 100
const MAX_PCT = Math.max(...gridBps) / 100
const AUTO_BUY_PTS = AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS / 100
const RESELLER_PCT = RESELLER_PLATFORM_FEE_BPS / 100

type Props = {
  variant?: "compact" | "full"
  className?: string
}

/** Supplier-facing summary of how Affisell is paid: category rate on wholesale, auto-buy surcharge, flat reseller fee. */
export function SupplierFeeGridCard({ variant = "full", className }: Props) {
  const t = useTranslations("supplier.feeGrid")
  const range = t("range", { min: MIN_PCT, max: MAX_PCT })

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-violet-200/70 bg-violet-50/50 px-4 py-2.5 dark:border-violet-900/40 dark:bg-violet-950/20",
          className
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-900 dark:text-violet-100">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("compactTitle")}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-700 dark:bg-zinc-900/70 dark:text-violet-300">
          {range}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-700 dark:bg-zinc-900/70 dark:text-violet-300">
          {t("autoBuyShort", { pts: AUTO_BUY_PTS })}
        </span>
        <Link
          href="/dashboard/supplier/balance"
          className="ml-auto inline-flex min-h-8 items-center gap-0.5 text-xs font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300"
        >
          {t("details")}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    )
  }

  const tiles = [
    { key: "catalog", value: range, title: t("catalogTitle"), detail: t("catalogDetail") },
    { key: "autoBuy", value: t("autoBuyShort", { pts: AUTO_BUY_PTS }), title: t("autoBuyTitle"), detail: t("autoBuyDetail") },
    { key: "reseller", value: `${RESELLER_PCT}%`, title: t("resellerTitle"), detail: t("resellerDetail") },
  ]

  return (
    <section
      aria-labelledby="supplier-fee-grid-heading"
      className={cn(
        "space-y-4 rounded-3xl border border-zinc-200/80 bg-white/80 p-5 shadow-lg shadow-violet-500/5 dark:border-zinc-800/80 dark:bg-zinc-950/60 md:p-6",
        className
      )}
    >
      <header className="space-y-1.5">
        <h2 id="supplier-fee-grid-heading" className="text-balance text-lg font-bold tracking-tight md:text-xl">
          {t("title")}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <article key={tile.key} className="rounded-2xl border border-violet-200/60 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tile.title}</p>
            <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-violet-700 dark:text-violet-300">{tile.value}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{tile.detail}</p>
          </article>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">{t("footer")}</p>
    </section>
  )
}
