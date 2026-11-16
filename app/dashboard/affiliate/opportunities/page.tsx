import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import type { OpportunityFlag, RankedOpportunity } from "@/lib/intelligence/opportunities"
import { loadOpportunityBoard } from "@/lib/intelligence/opportunities.server"
import { loadOrFallback } from "@/lib/safe-server-data"

export const dynamic = "force-dynamic"

const EMPTY_BOARD = {
  ranked: [] as RankedOpportunity[],
  noSalesData: [] as Array<{ productId: string; name: string; imageUrl: string | null; supplierLabel: string; resellerPayoutPerUnitCents: number }>,
  platformRefundRateBps: 0,
  platformOrders90: 0,
  generatedAt: new Date(0).toISOString(),
  windows: { salesDays: 30, qualityDays: 90 },
}

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function pct(bps: number): string {
  return `${(bps / 100).toFixed(1).replace(".", ",")} %`
}

/**
 * Sales-based opportunity board (lib/intelligence/opportunities.ts). Every number on this page is either counted from
 * Affisell's own orders or the settlement formula applied to them; nothing is predicted and no score is invented.
 */
export default async function AffiliateOpportunitiesPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/opportunities")
  const t = await getTranslations("affiliate.opportunities")
  const board = await loadOrFallback(
    "affiliate/opportunities",
    () => loadOpportunityBoard({ viewerAffiliateId: session.user.id, limit: 50 }),
    EMPTY_BOARD
  )

  const flagLabel = (f: OpportunityFlag) => t(`flags.${f}`)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          {t("intro", { days: board.windows.salesDays, qualityDays: board.windows.qualityDays })}
        </p>
        <p className="text-xs text-zinc-500">
          {t("platformRate", { rate: pct(board.platformRefundRateBps), orders: board.platformOrders90 })}
        </p>
      </header>

      {board.ranked.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {t("emptyRanked", { days: board.windows.salesDays })}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">{t("col.product")}</th>
                <th className="px-3 py-2 text-right">{t("col.units", { days: board.windows.salesDays })}</th>
                <th className="px-3 py-2 text-right">{t("col.perUnit")}</th>
                <th className="px-3 py-2 text-right">{t("col.refundRate")}</th>
                <th className="px-3 py-2 text-right">{t("col.observedNet", { days: board.windows.salesDays })}</th>
                <th className="px-3 py-2">{t("col.checks")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {board.ranked.map((o) => {
                const units = o.factors.find((f) => f.key === "units_sold")?.value ?? 0
                return (
                  <tr key={o.productId} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{o.name}</div>
                      <div className="text-xs text-zinc-500">{o.supplierLabel}</div>
                      {o.alreadyListedByViewer ? (
                        <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          {t("inStore")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{units}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{euros(o.resellerPayoutPerUnitCents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {pct(o.refundRateBps)}
                      <div className="text-[11px] text-zinc-500">
                        {o.refundRateSource === "product" ? t("rateOwn") : t("ratePlatform")}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{euros(o.observedNetEarnings30Cents)}</td>
                    <td className="px-3 py-3">
                      {o.flags.length === 0 ? (
                        <span className="text-xs text-zinc-500">—</span>
                      ) : (
                        <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                          {o.flags.map((f) => (
                            <li key={f}>{flagLabel(f)}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-500">{t("howToRead")}</p>

      {board.noSalesData.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("noSalesTitle")}</h2>
          <p className="text-xs text-zinc-500">{t("noSalesIntro")}</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {board.noSalesData.slice(0, 24).map((p) => (
              <li key={p.productId} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</div>
                <div className="text-xs text-zinc-500">
                  {p.supplierLabel} · {t("perUnitShort", { amount: euros(p.resellerPayoutPerUnitCents) })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/dashboard/affiliate/catalog" className="inline-block text-sm font-medium text-violet-700 hover:underline">
        {t("toCatalog")}
      </Link>
    </div>
  )
}
