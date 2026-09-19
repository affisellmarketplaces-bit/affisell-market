"use client"

import { useTranslations } from "next-intl"

import { SupplierFeeGridCard } from "@/components/supplier/supplier-fee-grid-card"
import { COMMISSION_GRID_MAP } from "@/lib/commission-grid-config"
import { AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS, RESELLER_PLATFORM_FEE_BPS } from "@/lib/money/sale-split"
import { cn } from "@/lib/utils"

const gridBps = Object.values(COMMISSION_GRID_MAP)
  .map((e) => e.affisellBps)
  .filter((b) => b > 0)
const MIN_PCT = Math.min(...gridBps) / 100
const MAX_PCT = Math.max(...gridBps) / 100

type Props = {
  className?: string
  /** admin = full grid; product = one-line summary on a product's supplier link. */
  variant?: "admin" | "product"
  /** Product variant: the product uses Affisell auto-buy. */
  highlightAutoBuy?: boolean
}

/** Admin-facing summary of the platform fee model (single source: lib/money/sale-split + commission grid). */
export function AffisellPlatformFeesExplainer({ className, variant = "admin", highlightAutoBuy }: Props) {
  const t = useTranslations("supplier.feeGrid")

  if (variant === "admin") return <SupplierFeeGridCard className={className} />

  const autoBuy = highlightAutoBuy === true
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        autoBuy
          ? "border-violet-300/60 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20"
          : "border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40",
        className
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {t("productTitle")}
      </p>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{t("productMode")}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {autoBuy ? t("productAutoBuy", { pts: AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS / 100 }) : t("productCatalog")}
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t("productFoot", { range: t("range", { min: MIN_PCT, max: MAX_PCT }), pct: RESELLER_PLATFORM_FEE_BPS / 100 })}
      </p>
    </div>
  )
}

export function AffisellFeeModeBadge({
  usesAffisellAutoBuy,
  className,
}: {
  usesAffisellAutoBuy: boolean
  className?: string
}) {
  const t = useTranslations("supplier.feeGrid")
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider",
        usesAffisellAutoBuy
          ? "border-violet-300/60 bg-violet-50 text-violet-700 dark:text-violet-300"
          : "border-zinc-300/60 bg-zinc-50 text-zinc-600 dark:text-zinc-300",
        className
      )}
    >
      {usesAffisellAutoBuy ? t("badgeAutoBuy") : t("badgeCatalog")}
    </span>
  )
}
