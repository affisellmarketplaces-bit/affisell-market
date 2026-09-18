import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import RadarTikTokRevenueChart from "@/components/radar/radar-tiktok-revenue-chart"
import type { AppLocale } from "@/lib/i18n-locale"
import type { TikTokSalesDashboard } from "@/lib/radar/aggregators/tiktok"

const NUMBER_LOCALE: Record<AppLocale, string> = {
  fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES", it: "it-IT", nl: "nl-NL", pl: "pl-PL", zh: "zh-CN",
}

function money(amount: number, currency: string, numLocale: string): string {
  try {
    return new Intl.NumberFormat(numLocale, {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toFixed(0)} ${currency}`
  }
}

function deltaLabel(pct: number | null, t: (k: string, v?: Record<string, string>) => string): string {
  if (pct == null) return t("deltaNa")
  const sign = pct > 0 ? "+" : ""
  return t("deltaVs", { pct: `${sign}${pct.toFixed(1)}%` })
}

function deltaClass(pct: number | null): string {
  if (pct == null) return "text-zinc-500"
  if (pct > 0) return "text-emerald-700"
  if (pct < 0) return "text-rose-700"
  return "text-zinc-500"
}

export default function RadarTikTokSalesSection({
  dashboard,
  hasConnection,
}: {
  dashboard: TikTokSalesDashboard | null
  hasConnection: boolean
}) {
  const t = useTranslations("radarPages")
  const locale = useLocale() as AppLocale
  const numLocale = NUMBER_LOCALE[locale] ?? "en-US"
  const m = (amount: number, currency: string) => money(amount, currency, numLocale)
  if (!hasConnection) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
        <h2 className="text-base font-semibold text-zinc-900">{t("tiktokTitle")}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {t("tiktokConnectPrompt")}
        </p>
        <Link
          href="/radar/connect"
          className="mt-4 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {t("tiktokConnectCta")}
        </Link>
      </section>
    )
  }

  if (!dashboard) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">{t("tiktokTitle")}</h2>
        <p className="mt-2 text-sm text-zinc-600">{t("tiktokMetricsUnavailable")}</p>
      </section>
    )
  }

  const { revenue, orders, aov, fees, daily, topProducts } = dashboard
  const currency = revenue.currency || "USD"

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t("tiktokTitle30")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {t("tiktokSyncNote")}
          </p>
        </div>
        <Link href="/radar/connect" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          {t("tiktokManage")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("tiktokRevenue")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {m(revenue.amount, currency)}
          </p>
          <p className={`mt-1 text-xs ${deltaClass(revenue.deltaPct)}`}>
            {deltaLabel(revenue.deltaPct, t)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("tiktokOrders")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {orders.count.toLocaleString(numLocale)}
          </p>
          <p className={`mt-1 text-xs ${deltaClass(orders.deltaPct)}`}>
            {deltaLabel(orders.deltaPct, t)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("tiktokAov")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {m(aov, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{t("tiktokRevenueOverOrders")}</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("tiktokFees")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {m(fees.total, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("tiktokFeesDetail", {
              platform: m(fees.platformFee, currency),
              shipping: m(fees.shippingFee, currency),
            })}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800">{t("tiktokDaily")}</h3>
        <RadarTikTokRevenueChart data={daily} currency={currency} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800">{t("tiktokTopProducts")}</h3>
        {topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            {t("tiktokNoOrders")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">{t("tiktokColImage")}</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">{t("tiktokColProduct")}</th>
                  <th className="px-2 py-2">{t("tiktokColQty")}</th>
                  <th className="px-2 py-2">{t("tiktokColRevenue")}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.sku} className="border-b border-zinc-100">
                    <td className="px-2 py-2">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="size-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-lg" aria-hidden>
                          🎵
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-zinc-700">{p.sku}</td>
                    <td className="max-w-xs px-2 py-2">
                      <span className="line-clamp-2 font-medium text-zinc-900">
                        {p.title ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-zinc-700">
                      {p.qty.toLocaleString(numLocale)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-zinc-900">
                      {m(p.revenue, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
