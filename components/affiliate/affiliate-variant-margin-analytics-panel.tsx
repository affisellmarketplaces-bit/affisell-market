import Link from "next/link"
import { BarChart3, Pencil } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { BentoCard } from "@/components/affisell/bento-ui"
import type { AffiliateVariantMarginAnalyticsSnapshot } from "@/lib/affiliate-variant-margin-analytics"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  data: AffiliateVariantMarginAnalyticsSnapshot
}

function variantLabel(key: string, tDefault: string): string {
  return key === "default" ? tDefault : key
}

export async function AffiliateVariantMarginAnalyticsPanel({ data }: Props) {
  const t = await getTranslations("affiliate.earnings.variantAnalytics")

  return (
    <section className="space-y-4" aria-labelledby="variant-margin-analytics-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand"
            aria-hidden
          >
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h2
              id="variant-margin-analytics-title"
              className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white"
            >
              {t("title")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle", { days: data.days })}</p>
          </div>
        </div>
        {data.totals.unitsSold > 0 ? (
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-2 text-right dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t("periodTotal")}</p>
            <p className="text-lg font-black tabular-nums text-brand">
              {formatStoreCurrencyFromCents(data.totals.netEarningsCents)}
            </p>
            <p className="text-xs text-zinc-500">
              {t("periodUnits", { count: data.totals.unitsSold })}
            </p>
          </div>
        ) : null}
      </div>

      {data.rows.length === 0 ? (
        <BentoCard className="border-dashed py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t("empty")}
        </BentoCard>
      ) : (
        <BentoCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  <th className="px-4 py-3">{t("colProduct")}</th>
                  <th className="px-4 py-3">{t("colVariant")}</th>
                  <th className="px-4 py-3 text-right">{t("colUnits")}</th>
                  <th className="px-4 py-3 text-right">{t("colMarkup")}</th>
                  <th className="px-4 py-3 text-right">{t("colAvgMargin")}</th>
                  <th className="px-4 py-3 text-right">{t("colConfigured")}</th>
                  <th className="px-4 py-3 text-right">{t("colConversion")}</th>
                  <th className="px-4 py-3 text-right">{t("colShare")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const configuredDrift =
                    row.configuredMarginCents != null &&
                    row.avgMarkupPerUnitCents > 0 &&
                    row.configuredMarginCents !== row.avgMarkupPerUnitCents
                  return (
                    <tr
                      key={`${row.listingId}:${row.variantKey}`}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                    >
                      <td className="max-w-[160px] truncate px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {row.productTitle}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {variantLabel(row.variantKey, t("defaultVariant"))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.unitsSold}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand">
                        {formatStoreCurrencyFromCents(row.netEarningsCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatStoreCurrencyFromCents(row.avgMarkupPerUnitCents)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          configuredDrift && "text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {row.configuredMarginCents != null
                          ? formatStoreCurrencyFromCents(row.configuredMarginCents)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {row.listingConversionPct != null ? `${row.listingConversionPct}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {row.shareOfListingSalesPct}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/affiliate?editListing=${encodeURIComponent(row.listingId)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-ai hover:underline"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          {t("editMargins")}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-zinc-200/80 px-4 py-3 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {t("footnote")}
          </p>
        </BentoCard>
      )}
    </section>
  )
}
