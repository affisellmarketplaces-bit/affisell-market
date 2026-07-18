import Link from "next/link"
import { redirect } from "next/navigation"

import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import RadarWorldMap from "@/lib/radar/map/RadarWorldMap"
import {
  MOCK_MAP_STATS,
  countryCodeToName,
  type CountryMapStat,
} from "@/lib/radar/map/geo"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { getRadarDb } from "@/lib/prisma-radar"

async function loadCountryStats(): Promise<{ stats: CountryMapStat[]; demo: boolean }> {
  if (!resolveRadarDatabaseUrl()) {
    return { stats: MOCK_MAP_STATS, demo: true }
  }

  try {
    const db = getRadarDb()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const grouped = await db.radarGlobalSnapshot.groupBy({
      by: ["country"],
      where: { crawledAt: { gte: since } },
      _count: { _all: true },
      _avg: { salesEst: true },
      orderBy: { _count: { country: "desc" } },
      take: 40,
    })

    if (grouped.length === 0) {
      return { stats: MOCK_MAP_STATS, demo: true }
    }

    const stats: CountryMapStat[] = []
    for (const row of grouped) {
      const top = await db.radarGlobalSnapshot.findFirst({
        where: { country: row.country, crawledAt: { gte: since } },
        orderBy: [{ salesEst: "desc" }, { rank: "asc" }],
        select: { title: true },
      })
      stats.push({
        country: row.country,
        count: row._count._all,
        avgSales: row._avg.salesEst ?? 0,
        topProductTitle: top?.title ?? null,
      })
    }

    return { stats, demo: false }
  } catch (err) {
    console.warn("[radar/map]", {
      result: "demo_fallback",
      message: err instanceof Error ? err.message : "unknown",
    })
    return { stats: MOCK_MAP_STATS, demo: true }
  }
}

export default async function RadarMapPage() {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const planUser = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro ?? false,
    features: session.user.features,
  }
  const plan = getUserRadarPlan(planUser)
  const mapAccess = checkRadarAccess(planUser, "map")

  const { stats, demo } = await loadCountryStats()
  const top5 = [...stats].sort((a, b) => b.count - a.count).slice(0, 5)

  if (!mapAccess.allowed) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-zinc-900">🗺️ Map Monde</h2>
        <RadarPaywallPanel
          plan={plan}
          title="Map Monde — Radar Pro"
          reason={mapAccess.reason ?? "Upgrade to Pro for Map"}
        >
          <div className="p-2">
            <RadarWorldMap stats={MOCK_MAP_STATS} demo />
          </div>
        </RadarPaywallPanel>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">🗺️ Map Monde — Winners live</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Points pulsants = activité bestsellers 24h. Clic pays → filtre dashboard.
          </p>
        </div>
        <Link href="/radar" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          ← Dashboard
        </Link>
      </div>

      <RadarWorldMap stats={stats} demo={demo} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Top 5 pays (24h)</h3>
        <ol className="mt-3 space-y-2">
          {top5.map((s, i) => (
            <li key={s.country} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-zinc-800">
                {i + 1}. {countryCodeToName(s.country)}{" "}
                <span className="text-zinc-400">({s.country})</span>
              </span>
              <span className="tabular-nums text-zinc-600">
                {s.count} produits · {Math.round(s.avgSales).toLocaleString("fr-FR")} ventes/j
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
