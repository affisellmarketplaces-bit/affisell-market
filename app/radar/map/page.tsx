import Link from "next/link"
import { redirect } from "next/navigation"

import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import RadarWorldMap from "@/lib/radar/map/RadarWorldMap"
import {
  MOCK_MAP_STATS,
  countryCodeToName,
  mergeMapStatsWithExpected,
  type CountryMapStat,
} from "@/lib/radar/map/geo"
import { auth } from "@/lib/auth"
import {
  DEFAULT_RADAR_COUNTRIES,
  parseRadarCountries,
} from "@/lib/radar/crawler/global-scan"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { loadRadarPlanContext } from "@/lib/radar/plan-user.server"
import { getRadarDb } from "@/lib/prisma-radar"

async function loadCountryStats(): Promise<{
  stats: CountryMapStat[]
  demo: boolean
  expected: string[]
}> {
  // Always show the full default coverage grid on the map — even if RADAR_COUNTRIES
  // env still lists the old 5 (crawl override). Live + pending markers.
  const expected = [
    ...new Set([...DEFAULT_RADAR_COUNTRIES, ...parseRadarCountries()]),
  ]

  if (!resolveRadarDatabaseUrl()) {
    return {
      stats: mergeMapStatsWithExpected(MOCK_MAP_STATS, expected),
      demo: true,
      expected,
    }
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
      take: 80,
    })

    if (grouped.length === 0) {
      return {
        stats: mergeMapStatsWithExpected(MOCK_MAP_STATS, expected),
        demo: true,
        expected,
      }
    }

    const live: CountryMapStat[] = []
    for (const row of grouped) {
      const top = await db.radarGlobalSnapshot.findFirst({
        where: { country: row.country, crawledAt: { gte: since } },
        orderBy: [{ salesEst: "desc" }, { rank: "asc" }],
        select: { title: true },
      })
      live.push({
        country: row.country,
        count: row._count._all,
        avgSales: row._avg.salesEst ?? 0,
        topProductTitle: top?.title ?? null,
        pending: false,
      })
    }

    const stats = mergeMapStatsWithExpected(live, expected)
    console.log("[radar/map]", {
      result: "stats_ok",
      liveCountries: live.length,
      mapMarkers: stats.length,
      expected: expected.length,
      pending: stats.filter((s) => s.pending).length,
    })
    return { stats, demo: false, expected }
  } catch (err) {
    console.warn("[radar/map]", {
      result: "demo_fallback",
      message: err instanceof Error ? err.message : "unknown",
    })
    return {
      stats: mergeMapStatsWithExpected(MOCK_MAP_STATS, expected),
      demo: true,
      expected,
    }
  }
}

export default async function RadarMapPage() {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { planUser, plan } = await loadRadarPlanContext({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro,
    features: session.user.features,
  })
  const mapAccess = checkRadarAccess(planUser, "map")

  const { stats, demo, expected } = await loadCountryStats()
  const activeStats = stats.filter((s) => !s.pending && s.count > 0)
  const topCountries = [...activeStats].sort((a, b) => b.count - a.count).slice(0, 10)
  const pendingCount = stats.filter((s) => s.pending || s.count <= 0).length

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
            <RadarWorldMap
              stats={mergeMapStatsWithExpected(MOCK_MAP_STATS, [...DEFAULT_RADAR_COUNTRIES])}
              demo
            />
          </div>
        </RadarPaywallPanel>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">🗺️ Map Monde — Winners (analyse quotidienne)</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {stats.length} pays couverts · {activeStats.length} actifs (24h)
            {pendingCount > 0 ? ` · ${pendingCount} en attente du prochain scan` : ""}. Clique un pays
            pour voir les winners.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/radar/globe"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Globe LIVE
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          </Link>
          <Link href="/radar" className="text-sm font-medium text-violet-600 hover:text-violet-700">
            ← Dashboard
          </Link>
        </div>
      </div>

      <RadarWorldMap stats={stats} demo={demo} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Top pays actifs (24h)</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Scan attendu : {expected.join(", ")}
          {demo ? " · mode demo" : ""}
        </p>
        <ol className="mt-3 space-y-2">
          {topCountries.map((s, i) => (
            <li key={s.country} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link
                href={`/radar/winners?country=${encodeURIComponent(s.country)}`}
                className="font-medium text-zinc-800 hover:text-violet-700"
              >
                {i + 1}. {countryCodeToName(s.country)}{" "}
                <span className="text-zinc-400">({s.country})</span>
              </Link>
              <span className="tabular-nums text-zinc-600">
                {s.count} produits · score demande {Math.round(s.avgSales).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ol>
        {topCountries.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Aucun snapshot 24h encore — lance un Force Scan (admin) ou attends le cron 6h. Les{" "}
            {stats.length} markers sur la carte restent visibles.
          </p>
        ) : null}
      </section>
    </div>
  )
}
