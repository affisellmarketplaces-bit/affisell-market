import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PREVIEW_COUNTRIES = [
  { flag: "🇫🇷", code: "FR", winners: 20, ago: "2m" },
  { flag: "🇩🇪", code: "DE", winners: 20, ago: "5m" },
  { flag: "🇺🇸", code: "US", winners: 20, ago: "1m" },
  { flag: "🇯🇵", code: "JP", winners: 20, ago: "12m" },
  { flag: "🇧🇷", code: "BR", winners: 20, ago: "8m" },
  { flag: "🇲🇦", code: "MA", winners: 20, ago: "15m" },
] as const

const PREVIEW_WINNERS = [
  {
    rank: 1,
    country: "FR",
    title: "Bande LED RGB WiFi 5m",
    growth: 127,
    price: "24,99 €",
    searches: "22.1k",
  },
  {
    rank: 2,
    country: "DE",
    title: "LED Strip RGB Alexa 10m",
    growth: 134,
    price: "22,99 €",
    searches: "19.8k",
  },
  {
    rank: 3,
    country: "US",
    title: "Stanley Tumbler Dupe 40oz",
    growth: 156,
    price: "$18.99",
    searches: "52k",
  },
  {
    rank: 4,
    country: "JP",
    title: "MagSafe iPhone ケース",
    growth: 112,
    price: "¥1,980",
    searches: "28.4k",
  },
  {
    rank: 5,
    country: "BR",
    title: "Cinta Modeladora",
    growth: 138,
    price: "R$ 49,90",
    searches: "35.2k",
  },
] as const

/**
 * Landing — World Radar Terminal preview (marketing, not live data).
 * Sits above Producteur/Grossiste teaser. Justifies Radar Pro ~99€/mo.
 */
export function HomeWorldRadarTeaser({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border-t border-violet-500/40",
        "bg-[#050507] px-5 py-14 text-white sm:px-10 sm:py-20",
        className
      )}
      aria-labelledby="home-world-radar-heading"
    >
      {/* Linear-style grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 20%, black, transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-violet-600/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 size-80 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-violet-300 uppercase sm:text-xs">
            <span
              className="inline-block size-1.5 animate-pulse rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]"
              aria-hidden
            />
            🌍 WORLD RADAR — NOUVEAU — 30 MARCHÉS
          </p>
          <h2
            id="home-world-radar-heading"
            className="mx-auto mt-5 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-4xl sm:leading-[1.12] lg:text-[44px]"
          >
            Le seul terminal qui scanne 30 pays — analyse quotidienne.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            De Paris à Tokyo. De Berlin à São Paulo. Vois les winners avant tout le monde.
          </p>
        </div>

        {/* Fake Bloomberg / macOS terminal */}
        <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0a0a0c] shadow-[0_40px_100px_rgba(0,0,0,0.65)] ring-1 ring-violet-500/20">
          <div className="flex items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3">
            <div className="flex gap-1.5" aria-hidden>
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-400 sm:text-xs">
              <span className="text-emerald-400">affisell@world-radar</span>
              <span className="text-zinc-600"> ~ </span>
              <span className="text-zinc-300">
                analyse quotidienne — 30 countries — last update: 4h ago
              </span>
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                MAJ 6h
              </span>
            </p>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
            {/* Countries column */}
            <div className="border-b border-zinc-800/80 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <p className="mb-3 font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                Markets · scan rotation
              </p>
              <ul className="space-y-1.5">
                {PREVIEW_COUNTRIES.map((c, i) => (
                  <li
                    key={c.code}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 font-mono text-xs text-zinc-300 transition hover:bg-white/[0.04]"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="text-base">
                        {c.flag}
                      </span>
                      <span className="font-semibold text-white">{c.code}</span>
                      <span className="truncate text-zinc-500">— {c.winners} winners</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-emerald-400/90">
                      ● {c.ago} ago
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 px-2.5 font-mono text-[10px] text-zinc-600">
                +24 markets · Europe · America · Asia · Africa
              </p>
            </div>

            {/* Winners column */}
            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                  Top winners · trendingScore ↓
                </p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
                  +127% avg growth
                </span>
              </div>
              <ul className="space-y-2">
                {PREVIEW_WINNERS.map((w) => (
                  <li
                    key={`${w.country}-${w.rank}`}
                    className="group flex items-center gap-3 rounded-xl border border-transparent bg-white/[0.03] px-3 py-2.5 transition hover:border-violet-500/25 hover:bg-white/[0.05]"
                  >
                    <span className="w-6 shrink-0 font-mono text-xs font-bold text-zinc-500">
                      #{w.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        <span className="mr-1.5 text-zinc-500">{w.country}</span>
                        {w.title}
                        {w.growth > 120 ? (
                          <span className="ml-1.5" aria-label="Hot">
                            🔥
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                        {w.searches} recherches · concurrence faible
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-semibold text-emerald-400">
                        +{w.growth}%
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{w.price}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 bg-zinc-950/60 px-4 py-2.5 font-mono text-[10px] text-zinc-500 sm:text-[11px]">
            <span>cache TTL 6h · cron rotate 5 countries / run · zero SERPER spam</span>
            <span className="text-violet-300/80">Radar Pro · 99€/mois</span>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-3 text-center">
          <Button asChild variant="bentoAccent" size="lg" className="h-12 min-w-[280px] px-8 text-base">
            <Link href="/radar">Ouvrir World Radar →</Link>
          </Button>
          <p className="max-w-md text-xs leading-relaxed text-zinc-500 sm:text-sm">
            30 marchés. Signaux e-commerce. Un terminal. Moins cher qu&apos;un stagiaire qui scrape
            les dynamiques de marché à la main.
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <Link href="/pricing?feature=radar">Voir Radar Pro — 99€/mois</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
