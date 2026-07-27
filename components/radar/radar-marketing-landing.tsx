import Link from "next/link"
import { Check, Sparkles } from "lucide-react"

import RadarWorldMap from "@/lib/radar/map/RadarWorldMap"
import { MOCK_MAP_STATS } from "@/lib/radar/map/geo"
import { RADAR_PLANS } from "@/lib/radar/plans"
import { buildRadarPricingCards, RADAR_PRICING_TRUST } from "@/lib/radar/pricing-copy"
import { formatRadarPlanPrice, radarGlobalUnlockLabel } from "@/lib/radar/pricing-display"
import { cn } from "@/lib/utils"

const PAID_RADAR_CARDS = buildRadarPricingCards().filter(
  (c) => c.planId === "pro" || c.planId === "global"
)

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
          <p className="mt-1 text-zinc-400">
            Dynamiques de marché élevées, signal détecté il y a 4 jours
          </p>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-5xl px-4 pb-20">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Abonnement Radar
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Le signal avant le marché</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
            Des quotas clairs, des outcomes business — pas une liste sèche de cases cochées.
          </p>
        </div>

        <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {RADAR_PRICING_TRUST.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-center"
            >
              <p className="text-lg font-semibold tabular-nums text-emerald-400">{item.label}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {PAID_RADAR_CARDS.map((card) => {
            const p = RADAR_PLANS[card.planId]
            const featured = card.planId === "global"
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl border p-6 text-left",
                  featured
                    ? "border-emerald-400/60 bg-zinc-950 shadow-[0_0_40px_-18px_rgba(16,185,129,0.55)]"
                    : "border-zinc-700 bg-zinc-950"
                )}
              >
                {featured ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.28),transparent_70%)]"
                  />
                ) : null}
                <div className="relative flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                      {card.eyebrow}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">{p.name}</p>
                  </div>
                  {card.badge ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        featured ? "bg-emerald-400 text-zinc-950" : "bg-zinc-800 text-emerald-200"
                      )}
                    >
                      {featured ? <Sparkles className="size-3" aria-hidden /> : null}
                      {card.badge}
                    </span>
                  ) : null}
                </div>
                <p className="relative mt-3 text-3xl font-semibold">
                  {formatRadarPlanPrice(p.id, { includeSuffix: false })}
                  <span className="ml-1 text-sm font-normal text-zinc-500">/mois</span>
                </p>
                <p className="relative mt-3 text-sm leading-relaxed text-zinc-400">{card.blurb}</p>
                <p className="relative mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
                  {card.outcome}
                </p>
                <ul className="relative mt-5 flex-1 space-y-3">
                  {card.features
                    .filter((f) => f.included)
                    .map((f) => (
                      <li key={f.label} className="flex gap-2.5">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-zinc-100">{f.label}</span>
                          {f.detail ? (
                            <span className="mt-0.5 block text-[11px] text-zinc-500">{f.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ul>
                <Link
                  href="/pricing?feature=radar"
                  className={cn(
                    "relative mt-6 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition",
                    featured
                      ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                      : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  )}
                >
                  Activer {p.name}
                </Link>
                {card.ctaHint ? (
                  <p className="relative mt-2 text-center text-[11px] text-zinc-500">{card.ctaHint}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
