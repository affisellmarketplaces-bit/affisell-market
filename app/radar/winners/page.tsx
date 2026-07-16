import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getRadarDb } from "@/lib/prisma-radar"
import { getConnectorById } from "@/lib/radar/connectors/registry"
import { RADAR_DEMO_WINNERS } from "@/lib/radar/demo-data"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { isRadarEnabled } from "@/lib/radar/gate"

function formatPrice(price: { toString(): string } | number, currency: string | null): string {
  const n = typeof price === "number" ? price : Number(price.toString())
  if (!Number.isFinite(n)) return "—"
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency && currency.length === 3 ? currency : "USD",
    }).format(n)
  } catch {
    return `${n} ${currency ?? ""}`.trim()
  }
}

export default async function RadarWinnersPage() {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const features = resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) redirect("/pricing")

  let demoMode = false
  let winners: Array<{
    id: string
    title: string
    marketplaceId: string
    country: string
    price: { toString(): string } | number
    currency: string | null
    rank: number | null
    salesEst: number | null
    url: string | null
  }> = []

  if (!resolveRadarDatabaseUrl()) {
    demoMode = true
  } else {
    try {
      winners = await getRadarDb().radarGlobalSnapshot.findMany({
        where: { rank: { lte: 20 } },
        orderBy: [{ rank: "asc" }, { crawledAt: "desc" }],
        take: 50,
      })
    } catch (err) {
      demoMode = true
      console.warn("[radar/winners]", {
        result: "demo_mode",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  if (demoMode || winners.length === 0) {
    if (demoMode) winners = RADAR_DEMO_WINNERS
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">🏆 Winners — Top rank ≤ 20</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Snapshots globaux Radar{demoMode ? " (mode demo)" : ""}.
          </p>
        </div>
        <Link href="/radar" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          ← Dashboard
        </Link>
      </div>

      {demoMode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Radar DB offline, mode demo
        </div>
      )}

      {winners.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Aucun winner encore. Lance un scan global ou configure les clés crawler.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Marketplace</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Sales est.</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((row) => {
                const connector = getConnectorById(row.marketplaceId)
                return (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs">{row.rank ?? "—"}</td>
                    <td className="max-w-sm px-3 py-2">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 font-medium text-zinc-900 hover:text-violet-700"
                        >
                          {row.title}
                        </a>
                      ) : (
                        <span className="line-clamp-2 font-medium">{row.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {connector?.logo} {connector?.name ?? row.marketplaceId}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPrice(row.price, row.currency)}
                    </td>
                    <td className="px-3 py-2">{row.country}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.salesEst != null ? row.salesEst.toLocaleString("fr-FR") : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
