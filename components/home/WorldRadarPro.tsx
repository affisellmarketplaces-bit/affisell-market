"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SCAN_MARKETS = [
  { flag: "🇫🇷", code: "FR", angle: -90 },
  { flag: "🇩🇪", code: "DE", angle: -30 },
  { flag: "🇺🇸", code: "US", angle: 30 },
  { flag: "🇯🇵", code: "JP", angle: 90 },
  { flag: "🇧🇷", code: "BR", angle: 150 },
  { flag: "🇲🇦", code: "MA", angle: 210 },
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

const SWEEP_MS = 4000

function MarketBlip({
  flag,
  code,
  angle,
  active,
}: {
  flag: string
  code: string
  angle: number
  active: boolean
}) {
  const rad = (angle * Math.PI) / 180
  const r = 42
  const x = 50 + Math.cos(rad) * r
  const y = 50 + Math.sin(rad) * r

  return (
    <div
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
        active ? "scale-110 opacity-100" : "scale-90 opacity-40"
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-xl border px-1.5 py-1 backdrop-blur-sm transition-all duration-300",
          active
            ? "border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
            : "border-white/10 bg-black/40"
        )}
      >
        <span className="text-base leading-none" aria-hidden>
          {flag}
        </span>
        <span
          className={cn(
            "font-mono text-[9px] font-bold tracking-wider",
            active ? "text-emerald-300" : "text-zinc-500"
          )}
        >
          {code}
        </span>
      </div>
      {active ? (
        <span className="absolute -inset-1 -z-10 animate-ping rounded-xl bg-emerald-400/20" aria-hidden />
      ) : null}
    </div>
  )
}

function RadarSweepDisk({ reduceMotion }: { reduceMotion: boolean }) {
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const tick = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % SCAN_MARKETS.length)
    }, SWEEP_MS / SCAN_MARKETS.length)
    return () => window.clearInterval(tick)
  }, [reduceMotion])

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] sm:max-w-[380px]"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,80,255,0.18),transparent_70%)]" />

      {/* Range rings */}
      <div className="absolute left-1/2 top-1/2 size-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />
      <div className="absolute left-1/2 top-1/2 size-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
      <div className="absolute left-1/2 top-1/2 size-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/20" />
      <div className="absolute left-1/2 top-1/2 size-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/30 bg-emerald-400/5" />

      {/* Crosshair */}
      <div className="absolute left-1/2 top-[6%] h-[88%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <div className="absolute left-[6%] top-1/2 h-px w-[88%] -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Sweep beam */}
      {reduceMotion ? (
        <div className="absolute left-1/2 top-1/2 h-[2px] w-[44%] origin-left -translate-y-1/2 rotate-45 bg-gradient-to-r from-violet-400/80 via-violet-300/40 to-transparent" />
      ) : (
        <motion.div
          className="absolute left-1/2 top-1/2 size-[88%] -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: 360 }}
          transition={{ duration: SWEEP_MS / 1000, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[50%] w-[50%] origin-bottom-left"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(167,139,250,0.05) 40deg, rgba(167,139,250,0.45) 70deg, transparent 90deg)",
            }}
          />
          <div className="absolute left-1/2 top-1/2 h-[2px] w-[44%] origin-left -translate-y-1/2 bg-gradient-to-r from-violet-200 via-violet-400 to-transparent shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
        </motion.div>
      )}

      {/* Market blips */}
      {SCAN_MARKETS.map((m, i) => (
        <MarketBlip
          key={m.code}
          flag={m.flag}
          code={m.code}
          angle={m.angle}
          active={reduceMotion ? true : i === activeIdx}
        />
      ))}

      {/* Center label */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-emerald-300/90 sm:text-[10px]">
          SCANNING
        </p>
        <p className="mt-0.5 font-mono text-[10px] font-semibold tracking-tight text-white sm:text-xs">
          30 MARKETS
        </p>
      </div>
    </div>
  )
}

/**
 * Home World Radar — military scan terminal (marketing preview).
 * Linear / Vercel / Vision Pro energy — not a static country list.
 */
export function WorldRadarPro({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion() ?? false

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10",
        "bg-[#0a0a0f] px-4 py-10 text-white sm:px-8 sm:py-14 md:px-10 md:py-16",
        className
      )}
      aria-labelledby="home-world-radar-heading"
    >
      {/* Fine grid + violet radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,80,255,0.14),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 size-72 rounded-full bg-violet-600/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 size-80 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.22em] text-violet-300 uppercase sm:text-xs">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            </span>
            WORLD RADAR — NOUVEAU — 30 MARCHÉS
          </p>
          <h2
            id="home-world-radar-heading"
            className="mx-auto mt-4 max-w-4xl text-balance text-3xl font-bold tracking-tight text-white sm:mt-5 sm:text-4xl sm:leading-[1.12] lg:text-[44px]"
          >
            Le seul terminal qui scanne 30 pays — analyse quotidienne.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-400 sm:mt-4 sm:text-base sm:text-lg">
            De Paris à Tokyo. De Berlin à São Paulo. Vois les winners avant tout le monde.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:mt-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-8">
          <RadarSweepDisk reduceMotion={reduceMotion} />

          {/* Terminal winners */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-violet-500/15 backdrop-blur-sm">
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </div>
              <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400 sm:text-[11px]">
                <span className="text-emerald-400">affisell@world-radar</span>
                <span className="text-zinc-600"> ~ </span>
                <span className="text-zinc-300">top winners · live feed</span>
              </p>
              <span className="hidden shrink-0 items-center gap-1 font-mono text-[10px] text-emerald-400 sm:inline-flex">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                MAJ 6h
              </span>
            </div>

            <div className="border-b border-white/5 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                  Top winners · trendingScore ↓
                </p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
                  +127% avg
                </span>
              </div>
            </div>

            <ul className="divide-y divide-white/[0.04]">
              {PREVIEW_WINNERS.map((w) => (
                <li key={`${w.country}-${w.rank}`}>
                  <div className="group flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-violet-500/10">
                    <span className="w-7 shrink-0 font-mono text-xs font-bold text-zinc-500 group-hover:text-violet-300">
                      #{w.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        <span className="mr-1.5 font-mono text-[11px] text-violet-300/90">
                          {w.country}
                        </span>
                        {w.title}
                        {w.growth > 120 ? (
                          <span className="ml-1.5" aria-label="Hot">
                            🔥
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-500">
                        {w.searches} recherches · concurrence faible
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-bold tabular-nums text-emerald-400">
                        +{w.growth}%
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-400">
                        {w.price}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-[10px] text-zinc-500 sm:text-[11px]">
              <span>cache TTL 6h · cron rotate · zero SERPER spam</span>
              <span className="text-violet-300/80">Radar Pro · 99€/mois</span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-3 text-center sm:mt-12">
          <Button
            asChild
            variant="bentoAccent"
            size="lg"
            className={cn(
              "relative h-12 min-w-[280px] overflow-hidden px-8 text-base",
              !reduceMotion && "animate-[affisell-radar-cta-pulse_2.4s_ease-in-out_infinite]"
            )}
          >
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

/** Alias for home below-fold dynamic import. */
export function HomeWorldRadarTeaser(props: { className?: string }) {
  return <WorldRadarPro {...props} />
}
