import Link from "next/link"

import RadarWorldMap from "@/lib/radar/map/RadarWorldMap"
import { MOCK_MAP_STATS } from "@/lib/radar/map/geo"
import { RADAR_PLANS } from "@/lib/radar/plans"
import { formatRadarPlanPrice, radarGlobalUnlockLabel } from "@/lib/radar/pricing-display"

/** Public marketing landing for Affisell Radar (unauthenticated /radar). */
export default function RadarMarketingLanding() {
  return (
    <div className="min-h-screen bg-[#070b14] text-zinc-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <p className="text-sm font-semibold tracking-wide text-emerald-400">AFFISELL RADAR</p>
        <Link
          href="/pricing?feature=radar"
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Activer Radar
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-10 pt-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          📡 AFFISELL RADAR — Le premier radar e-commerce mondial
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Crawl mondial, détection de winners &lt;30j, alerte Slack à 3h du matin — avant tes
          concurrents.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/pricing?feature=radar"
            className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Activer Radar
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Se connecter
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4">
        <RadarWorldMap stats={MOCK_MAP_STATS} demo className="shadow-2xl shadow-emerald-900/20" />
      </section>

      <section className="mx-auto mt-12 grid max-w-5xl gap-4 px-4 sm:grid-cols-3">
        {[
          { t: "Crawl 1M produits/jour", d: "TikTok, Amazon SP-API, Merchant + crawler global." },
          { t: "Détecte winners <30j", d: "5 règles WINNER DETECTED — rank, ventes, saturation." },
          { t: "Alerte Slack 3h du mat", d: `Tu sais avant le marché. ${radarGlobalUnlockLabel({ short: true })}.` },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 text-left">
            <h2 className="text-sm font-semibold text-emerald-300">{c.t}</h2>
            <p className="mt-2 text-sm text-zinc-400">{c.d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-12 max-w-5xl px-4">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 font-mono text-xs text-emerald-200 sm:text-sm">
          <p className="text-zinc-500"># slack · WINNER DETECTED</p>
          <p className="mt-2">*CRITICAL* — Nouveau winner: Shapewear High-Waist #3 sur tiktok_shop BR</p>
          <p className="mt-1 text-zinc-400">12 400 ventes/j estimées, apparu il y a 4 jours</p>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-5xl px-4 pb-20">
        <h2 className="text-center text-lg font-semibold">Pricing</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[RADAR_PLANS.pro, RADAR_PLANS.global].map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-700 bg-zinc-950 p-6 text-left"
            >
              <p className="text-sm font-medium text-emerald-400">{p.name}</p>
              <p className="mt-2 text-3xl font-semibold">
                {formatRadarPlanPrice(p.id, { short: true })}
              </p>
              <ul className="mt-4 space-y-1 text-sm text-zinc-400">
                <li>{p.maxShops} shops</li>
                <li>{p.maxProducts.toLocaleString("fr-FR")} produits</li>
                <li>{p.maxAlerts} alertes</li>
                <li>Map {p.hasMap ? "✓" : "—"}</li>
                <li>Slack {p.hasSlack ? "✓" : "—"}</li>
              </ul>
              <Link
                href="/pricing?feature=radar"
                className="mt-6 inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                Activer Radar
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
