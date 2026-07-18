import Link from "next/link"

import RadarTikTokRevenueChart from "@/components/radar/radar-tiktok-revenue-chart"
import type { TikTokSalesDashboard } from "@/lib/radar/aggregators/tiktok"

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toFixed(0)} ${currency}`
  }
}

function deltaLabel(pct: number | null): string {
  if (pct == null) return "n/a vs période préc."
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}% vs période préc.`
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
  if (!hasConnection) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
        <h2 className="text-base font-semibold text-zinc-900">Ventes TikTok Shop</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Connecte ton shop TikTok pour voir CA, commandes, frais et top produits dans Radar.
        </p>
        <Link
          href="/radar/connect"
          className="mt-4 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Connecter TikTok Shop
        </Link>
      </section>
    )
  }

  if (!dashboard) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Ventes TikTok Shop</h2>
        <p className="mt-2 text-sm text-zinc-600">Chargement des métriques indisponible.</p>
      </section>
    )
  }

  const { revenue, orders, aov, fees, daily, topProducts } = dashboard
  const currency = revenue.currency || "USD"

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Ventes TikTok Shop (30j)</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Sync auto toutes les 15 min · full sync quotidien 02:00 UTC
          </p>
        </div>
        <Link href="/radar/connect" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          Gérer connexions
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">CA TikTok</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {money(revenue.amount, currency)}
          </p>
          <p className={`mt-1 text-xs ${deltaClass(revenue.deltaPct)}`}>
            {deltaLabel(revenue.deltaPct)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Commandes</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {orders.count.toLocaleString("fr-FR")}
          </p>
          <p className={`mt-1 text-xs ${deltaClass(orders.deltaPct)}`}>
            {deltaLabel(orders.deltaPct)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Panier moyen</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {money(aov, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">CA / commandes</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Frais TikTok</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {money(fees.total, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            plateforme {money(fees.platformFee, currency)} · ship{" "}
            {money(fees.shippingFee, currency)}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800">CA TikTok par jour</h3>
        <RadarTikTokRevenueChart data={daily} currency={currency} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800">Top produits TikTok</h3>
        {topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Aucune commande synchronisée — le cron 15 min ou un webhook peuplera cette table.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Image</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Produit</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">CA</th>
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
                      {p.qty.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-zinc-900">
                      {money(p.revenue, currency)}
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
