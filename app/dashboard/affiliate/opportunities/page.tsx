import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { MIN_ORDERS_DOCUMENTED, type OpportunityFlag, type RankedOpportunity } from "@/lib/intelligence/opportunities"
import { loadOpportunityBoard, type OpportunityBoardResult } from "@/lib/intelligence/opportunities.server"
import type { AttentionItem, DeclineReason, PeriodSummary } from "@/lib/intelligence/reseller-performance"
import { loadResellerPerformance, type ResellerPerformanceResult } from "@/lib/intelligence/reseller-performance.server"
import { loadOrFallback } from "@/lib/safe-server-data"

export const dynamic = "force-dynamic"

const EMPTY_PERIOD: PeriodSummary = { orders: 0, units: 0, netCents: 0, netPerUnitCents: null, refundShareBps: 0, disputedOrders: 0 }

const EMPTY_BOARD: OpportunityBoardResult = {
  documented: [],
  limited: [],
  ranked: [],
  noSalesData: [],
  platformRefundRateBps: 0,
  platformOrders90: 0,
  generatedAt: new Date(0).toISOString(),
  windows: { salesDays: 30, qualityDays: 90 },
  truncated: false,
}

const EMPTY_MINE: ResellerPerformanceResult = {
  topEarners: [],
  declining: [],
  attention: [],
  totals: { current: EMPTY_PERIOD, previous: EMPTY_PERIOD },
  generatedAt: new Date(0).toISOString(),
  periodDays: 30,
  truncated: false,
}

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function pct(bps: number): string {
  return `${(bps / 100).toFixed(1).replace(".", ",")} %`
}

const TH = "px-3 py-2"
const TD = "px-3 py-3"

/**
 * Decision board for resellers. Top: the viewer's OWN products (their orders only). Below: the platform board, split
 * into well-documented products and products with too few orders. Every number is counted from Affisell's orders or the
 * settlement formula applied to them; nothing is predicted and no score is invented.
 */
export default async function AffiliateOpportunitiesPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/opportunities")
  const t = await getTranslations("affiliate.opportunities")
  const [board, mine] = await Promise.all([
    loadOrFallback("affiliate/opportunities", () => loadOpportunityBoard({ viewerAffiliateId: session.user.id, limit: 50 }), EMPTY_BOARD),
    loadOrFallback("affiliate/performance", () => loadResellerPerformance({ affiliateId: session.user.id, limit: 20 }), EMPTY_MINE),
  ])

  const flagLabel = (f: OpportunityFlag) => t(`flags.${f}`)
  const reasonLabel = (r: DeclineReason) => t(`mine.reasons.${r}`)
  const attentionLabel = (a: AttentionItem) => {
    const e = a.evidence
    switch (a.kind) {
      case "open_dispute":
        return t("mine.attention.open_dispute", { orders: Number(e.orders ?? 0) })
      case "supplier_price_changed":
        return t("mine.attention.supplier_price_changed", {
          from: euros(Number(e.fromCents ?? 0)),
          to: euros(Number(e.toCents ?? 0)),
        })
      case "return_requested":
        return t("mine.attention.return_requested", { returns: Number(e.returns ?? 0) })
      default:
        return t(`mine.attention.${a.kind}`)
    }
  }

  const boardTable = (list: RankedOpportunity[]) => (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className={TH}>{t("col.product")}</th>
            <th className={`${TH} text-right`}>{t("col.units", { days: board.windows.salesDays })}</th>
            <th className={`${TH} text-right`}>{t("col.perUnit")}</th>
            <th className={`${TH} text-right`}>{t("col.refundRate")}</th>
            <th className={`${TH} text-right`}>{t("col.disputeRate")}</th>
            <th className={`${TH} text-right`}>{t("col.observedNet", { days: board.windows.salesDays })}</th>
            <th className={TH}>{t("col.checks")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {list.map((o) => (
            <tr key={o.productId} className="align-top">
              <td className={TD}>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{o.name}</div>
                <div className="text-xs text-zinc-500">{o.supplierLabel}</div>
                {o.alreadyListedByViewer ? (
                  <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    {t("inStore")}
                  </span>
                ) : null}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {o.unitsChange.current}
                <div className="text-[11px] text-zinc-500">{t("vsPrevious", { prev: o.unitsChange.previous })}</div>
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {euros(o.resellerPayoutPerUnitCents)}
                {o.resellerPayoutPerUnit30dAgoCents !== null && o.resellerPayoutPerUnit30dAgoCents !== o.resellerPayoutPerUnitCents ? (
                  <div className="text-[11px] text-zinc-500">{t("perUnitWas", { amount: euros(o.resellerPayoutPerUnit30dAgoCents) })}</div>
                ) : null}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {pct(o.refundRateBps)}
                <div className="text-[11px] text-zinc-500">{o.refundRateSource === "product" ? t("rateOwn") : t("ratePlatform")}</div>
              </td>
              <td className={`${TD} text-right tabular-nums`}>{pct(o.disputeRateBps)}</td>
              <td className={`${TD} text-right font-semibold tabular-nums`}>{euros(o.observedNetEarnings30Cents)}</td>
              <td className={TD}>
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
          ))}
        </tbody>
      </table>
    </div>
  )

  const cur = mine.totals.current
  const prev = mine.totals.previous

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          {t("intro", { days: board.windows.salesDays, qualityDays: board.windows.qualityDays })}
        </p>
      </header>

      {/* ── The viewer's own products ─────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900 dark:bg-violet-950/20">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("mine.title")}</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("mine.intro", { days: mine.periodDays })}</p>
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            {t("mine.totals", {
              net: euros(cur.netCents),
              orders: cur.orders,
              prevNet: euros(prev.netCents),
              prevOrders: prev.orders,
              days: mine.periodDays,
            })}
          </p>
          {mine.truncated ? <p className="text-xs text-amber-700">{t("truncated")}</p> : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("mine.attentionTitle")}</h3>
          {mine.attention.length === 0 ? (
            <p className="text-xs text-zinc-500">{t("mine.attentionEmpty")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {mine.attention.map((a) => (
                <li key={`${a.kind}:${a.productId}`} className="flex flex-wrap gap-x-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{a.name}</span>
                  <span className="text-amber-800 dark:text-amber-300">{attentionLabel(a)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("mine.topTitle", { days: mine.periodDays })}</h3>
          {mine.topEarners.length === 0 ? (
            <p className="text-xs text-zinc-500">{t("mine.empty", { days: mine.periodDays })}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className={TH}>{t("mine.col.product")}</th>
                    <th className={`${TH} text-right`}>{t("mine.col.orders")}</th>
                    <th className={`${TH} text-right`}>{t("mine.col.net")}</th>
                    <th className={`${TH} text-right`}>{t("mine.col.perUnit")}</th>
                    <th className={`${TH} text-right`}>{t("mine.col.refundShare")}</th>
                    <th className={`${TH} text-right`}>{t("mine.col.previous")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {mine.topEarners.map((p) => (
                    <tr key={p.productId}>
                      <td className={`${TD} font-medium text-zinc-900 dark:text-zinc-100`}>{p.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{p.current.orders}</td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>{euros(p.current.netCents)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {p.current.netPerUnitCents === null ? "—" : euros(p.current.netPerUnitCents)}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{pct(p.current.refundShareBps)}</td>
                      <td className={`${TD} text-right tabular-nums text-zinc-500`}>
                        {euros(p.previous.netCents)}
                        {!p.comparable ? <div className="text-[11px]">{t("mine.notComparable")}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("mine.decliningTitle")}</h3>
          {mine.declining.length === 0 ? (
            <p className="text-xs text-zinc-500">{t("mine.decliningEmpty")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {mine.declining.map((d) => (
                <li key={d.productId} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {d.name} · {t("mine.netChange", { from: euros(d.previous.netCents), to: euros(d.current.netCents) })}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {d.reasons.length === 0 ? t("mine.reasons.unknown") : d.reasons.map(reasonLabel).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Platform board ────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("documentedTitle")}</h2>
        <p className="text-xs text-zinc-500">
          {t("documentedIntro", { min: MIN_ORDERS_DOCUMENTED, qualityDays: board.windows.qualityDays })}{" "}
          {t("platformRate", { rate: pct(board.platformRefundRateBps), orders: board.platformOrders90 })}
        </p>
        {board.truncated ? <p className="text-xs text-amber-700">{t("truncated")}</p> : null}
        {board.documented.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {t("documentedEmpty")}
          </p>
        ) : (
          boardTable(board.documented)
        )}
      </section>

      {board.limited.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("limitedTitle")}</h2>
          <p className="text-xs text-zinc-500">{t("limitedIntro")}</p>
          {boardTable(board.limited)}
        </section>
      ) : null}

      {board.documented.length === 0 && board.limited.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("emptyRanked", { days: board.windows.salesDays })}</p>
      ) : null}

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
