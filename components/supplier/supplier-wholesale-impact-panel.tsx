import Link from "next/link"
import { AlertTriangle, TrendingUp, Users } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { BentoCard } from "@/components/affisell/bento-ui"
import type { SupplierWholesaleImpactSnapshot } from "@/lib/supplier-wholesale-impact"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

type Props = {
  data: SupplierWholesaleImpactSnapshot
  productNameById: Record<string, string>
}

export async function SupplierWholesaleImpactPanel({ data, productNameById }: Props) {
  const t = await getTranslations("supplierDashboard.wholesaleImpact")

  if (data.totals.affiliateListingsLive === 0 && data.totals.marginReviewOpen === 0) {
    return null
  }

  const topRows = data.rows.filter((r) => r.marginReviewOpen > 0).slice(0, 5)

  return (
    <section className="mb-8 space-y-4" aria-labelledby="supplier-wholesale-impact-title">
      <BentoCard
        className={
          data.totals.marginReviewOpen > 0
            ? "border-amber-300/70 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 p-6 dark:border-amber-800/50 dark:from-amber-950/30 dark:via-zinc-950 dark:to-orange-950/20"
            : "border-teal-200/70 bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/40 p-6 dark:border-teal-900/40 dark:from-teal-950/25 dark:via-zinc-950"
        }
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {data.totals.marginReviewOpen > 0 ? (
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />
              ) : (
                <Users className="size-5 text-teal-600 dark:text-teal-400" aria-hidden />
              )}
              <h2
                id="supplier-wholesale-impact-title"
                className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white"
              >
                {t("title")}
              </h2>
            </div>
            <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              {data.totals.marginReviewOpen > 0 ? t("subtitleAlert") : t("subtitleHealthy")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("statPartners")} value={String(data.totals.affiliateListingsLive)} />
            <Stat
              label={t("statReviews")}
              value={String(data.totals.marginReviewOpen)}
              highlight={data.totals.marginReviewOpen > 0}
            />
            <Stat label={t("statUnits")} value={String(data.totals.unitsSold30d)} />
            <Stat
              label={t("statGmv")}
              value={formatStoreCurrencyFromCents(data.totals.wholesaleGmvCents30d)}
            />
          </div>
        </div>

        {topRows.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-amber-200/60 bg-white/70 dark:border-amber-900/40 dark:bg-zinc-950/50">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-amber-100 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-amber-900/30">
                  <th className="px-4 py-2.5">{t("colProduct")}</th>
                  <th className="px-4 py-2.5 text-right">{t("colPartners")}</th>
                  <th className="px-4 py-2.5 text-right">{t("colReviews")}</th>
                  <th className="px-4 py-2.5 text-right">{t("colUnits")}</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-b border-amber-50 last:border-0 dark:border-amber-950/30"
                  >
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium">
                      <Link
                        href={`/dashboard/supplier/products/new?edit=${encodeURIComponent(row.productId)}`}
                        className="text-zinc-900 hover:text-teal-700 hover:underline dark:text-zinc-100"
                      >
                        {productNameById[row.productId] ?? row.productId}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.affiliateListingsLive}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {row.marginReviewOpen}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.unitsSold30d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <TrendingUp className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("footnote", { days: data.days })}
        </p>
      </BentoCard>
    </section>
  )
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/90 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={
          highlight
            ? "mt-0.5 text-lg font-black tabular-nums text-amber-700 dark:text-amber-300"
            : "mt-0.5 text-lg font-black tabular-nums text-zinc-900 dark:text-white"
        }
      >
        {value}
      </p>
    </div>
  )
}
