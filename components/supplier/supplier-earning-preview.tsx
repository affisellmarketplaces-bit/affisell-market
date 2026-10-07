"use client"

import { Wallet } from "lucide-react"
import { useTranslations } from "next-intl"

import { useSupplierFeeBps } from "@/components/supplier/use-supplier-fee-bps"
import { formatStoreCurrency } from "@/lib/market-config"
import { computeEarningPreview } from "@/lib/supplier-earning-preview"
import { cn } from "@/lib/utils"

type Props = {
  priceEur: number
  commissionPct: number
  /** Exact (leaf) category: the Affisell rate depends on it. */
  categoryId: string
  className?: string
}

const pct = (n: number) => String(Math.round(n * 100) / 100)

/** What the supplier actually receives per sale, from the same arithmetic as the settlement (`lib/supplier-earning-preview.ts`). */
export function SupplierEarningPreview({ priceEur, commissionPct, categoryId, className }: Props) {
  const t = useTranslations("supplier.earningPreview")
  const { bps, loading } = useSupplierFeeBps(categoryId)
  const preview = computeEarningPreview({ priceEur, commissionPct, feeBps: bps })
  const money = (cents: number) => formatStoreCurrency(cents / 100)

  return (
    <section
      aria-label={t("title")}
      className={cn(
        "rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-white p-4 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-zinc-950",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
        <Wallet className="size-4 shrink-0" aria-hidden />
        {t("title")}
      </p>

      {preview.priceCents <= 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{t("enterPrice")}</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm" aria-busy={loading}>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600 dark:text-zinc-300">{t("price")}</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{money(preview.priceCents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600 dark:text-zinc-300">{t("commission", { pct: pct(commissionPct) })}</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">−{money(preview.commissionCents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600 dark:text-zinc-300">
              {preview.feeKnown && bps != null ? t("fee", { pct: pct(bps / 100) }) : t("feeUnknown")}
            </dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
              {preview.feeCents != null ? `−${money(preview.feeCents)}` : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-emerald-200/70 pt-2 dark:border-emerald-900/50">
            <dt className="font-semibold text-zinc-800 dark:text-zinc-100">{preview.feeKnown ? t("net") : t("netBeforeFee")}</dt>
            <dd className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{money(preview.netCents)}</dd>
          </div>
        </dl>
      )}

      {preview.priceCents > 0 && !preview.feeKnown && !loading && !categoryId.trim() ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">{t("feeHint")}</p>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{t("footnote")}</p>
    </section>
  )
}
