"use client"

import Link from "next/link"
import useSWR from "swr"
import { useCallback, useMemo, useState } from "react"

import { SupplierMatchBadge } from "@/components/radar/supplier-match-badge"
import { formatRadarPriceDisplay } from "@/lib/radar/format-radar-price"
import type { SupplierKind } from "@/lib/supplier-kind"
import {
  formatRelativeScanFr,
  type WorldRadarCountriesPayload,
  type WorldRadarPayload,
  type WorldRadarWinnerDto,
} from "@/lib/radar/world-radar-types"

type RegionTab = "all" | "Europe" | "America" | "Asia" | "Africa" | "Oceania"

const REGION_TABS: Array<{ id: RegionTab; label: string }> = [
  { id: "all", label: "🌍 Tous" },
  { id: "Europe", label: "🇪🇺 Europe" },
  { id: "America", label: "🌎 Amérique" },
  { id: "Asia", label: "🌏 Asie" },
  { id: "Africa", label: "🌍 Afrique" },
  { id: "Oceania", label: "🏝 Océanie" },
]

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`)
  return res.json()
}

function formatSearches(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k recherches`
  return `${n.toLocaleString("fr-FR")} recherches`
}

function competitionLabel(n: number | null, country: string): string {
  if (n == null) return "—"
  const suffix = ` vendeurs ${country}`
  if (n < 5) return `${n}${suffix}`
  return `${n}${suffix}`
}

function ArbitrageBadge({ row }: { row: WorldRadarWinnerDto }) {
  const a = row.arbitrage
  if (!a || a.tier === "none") return null
  return (
    <span
      className="mt-1.5 inline-flex max-w-full flex-col rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-[10px] leading-snug text-violet-900"
      title={a.hint}
    >
      <span className="font-bold tracking-wide">
        {a.tier === "or" ? "🔥 " : ""}
        {a.label}
      </span>
      <span className="font-medium text-violet-700">{a.hint}</span>
    </span>
  )
}

function SaturationCell({ row }: { row: WorldRadarWinnerDto }) {
  const s = row.saturation
  if (!s) return <span className="text-zinc-400">—</span>
  const barColor =
    s.tier === "vierge"
      ? "bg-emerald-500"
      : s.tier === "tot"
        ? "bg-amber-400"
        : "bg-red-500"
  return (
    <div className="min-w-[7rem]" title={s.prediction ?? undefined}>
      <div className="flex items-center justify-between gap-1 text-[10px] font-semibold">
        <span>
          {s.emoji} {s.label}
        </span>
        {s.daysUntilSaturation != null ? (
          <span className="text-zinc-500">~{s.daysUntilSaturation}j</span>
        ) : null}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, s.barPercent)}%` }}
        />
      </div>
    </div>
  )
}

function WinnersSkeleton() {
  return (
    <div className="mt-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100"
        />
      ))}
    </div>
  )
}

export default function WorldRadarTerminal({
  initialCountry,
  supplierKind,
}: {
  initialCountry: string
  supplierKind: SupplierKind
}) {
  const [country, setCountry] = useState(initialCountry.toUpperCase())
  const [regionTab, setRegionTab] = useState<RegionTab>("all")
  const [search, setSearch] = useState("")

  const { data: countriesData } = useSWR<WorldRadarCountriesPayload>(
    "/api/radar/countries",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600_000 }
  )

  const radarUrl = `/api/radar?country=${encodeURIComponent(country)}`
  const { data, error, isLoading, isValidating } = useSWR<WorldRadarPayload>(
    radarUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600_000 }
  )

  const filteredCountries = useMemo(() => {
    const list = countriesData?.countries ?? []
    if (regionTab === "all") return list
    return list.filter((c) => c.region === regionTab)
  }, [countriesData, regionTab])

  const filteredWinners = useMemo(() => {
    const winners = data?.winners ?? []
    const q = search.trim().toLowerCase()
    if (!q) return winners
    return winners.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.source.toLowerCase().includes(q) ||
        w.category?.toLowerCase().includes(q)
    )
  }, [data?.winners, search])

  const onSelectCountry = useCallback((code: string) => {
    setCountry(code.toUpperCase())
    const url = new URL(window.location.href)
    url.searchParams.set("country", code.toUpperCase())
    window.history.replaceState(null, "", url.toString())
  }, [])

  const lastScanLabel = formatRelativeScanFr(data?.lastScanAt)
  const isLive = data?.isLive ?? false
  const isGrossiste = supplierKind === "stocker" || supplierKind === "unset"

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-violet-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Affisell Intelligence
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              WORLD RADAR — Analyse quotidienne des marchés
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isLive ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${isLive ? "animate-pulse bg-emerald-400" : "bg-zinc-500"}`}
                  aria-hidden
                />
                {isLive ? "MAJ 6h" : "CACHE"}
                {lastScanLabel !== "jamais" ? ` · Dernière analyse ${lastScanLabel}` : ""}
              </span>
              {isValidating ? (
                <span className="text-xs text-violet-300">Actualisation…</span>
              ) : null}
            </p>
            <p className="mt-2 text-[11px] text-zinc-400">
              Signaux e-commerce · Arbitrage Score™ · Saturation · Supplier Match Affisell
            </p>
          </div>
          <div className="w-full max-w-sm">
            <label className="sr-only" htmlFor="world-radar-search">
              Rechercher
            </label>
            <input
              id="world-radar-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit, pays…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-4">
          {REGION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRegionTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                regionTab === tab.id
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filteredCountries.map((c) => {
            const active = c.code === country
            const ready = (c.productCount ?? 0) > 0
            if (!ready) {
              return (
                <div
                  key={c.code}
                  className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-left opacity-50"
                  aria-label={`${c.name} — bientôt disponible`}
                >
                  <div className="pointer-events-none absolute inset-0 backdrop-blur-[1px]" aria-hidden />
                  <span className="relative text-lg blur-[0.5px]" aria-hidden>
                    {c.flag}
                  </span>
                  <p className="relative mt-0.5 text-xs font-semibold text-zinc-700">{c.name}</p>
                  <span className="relative mt-1 inline-flex rounded-full bg-zinc-200/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                    🔒 Bientôt disponible
                  </span>
                  <p className="relative mt-1 text-[10px] text-zinc-500">Analyse en cours</p>
                  <button
                    type="button"
                    disabled
                    className="relative mt-1.5 cursor-not-allowed text-[10px] font-medium text-zinc-400"
                  >
                    Être alerté →
                  </button>
                </div>
              )
            }

            return (
              <button
                key={c.code}
                type="button"
                onClick={() => onSelectCountry(c.code)}
                className={`relative rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                {c.isLive ? (
                  <span
                    className="absolute right-2 top-2 size-2 rounded-full bg-emerald-500"
                    title="Scan récent"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="absolute right-2 top-2 size-2 rounded-full bg-emerald-400/70"
                    title="Données disponibles"
                    aria-hidden
                  />
                )}
                <span className="text-lg" aria-hidden>
                  {c.flag}
                </span>
                <p className="mt-0.5 text-xs font-semibold text-zinc-900">{c.name}</p>
                <p className="text-[10px] font-medium text-emerald-700">
                  {c.productCount} winners
                </p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">
            {data?.country.flag ?? "🌍"} Top winners {country}
            {error ? (
              <span className="ml-2 text-xs font-normal text-amber-600">mode dégradé</span>
            ) : null}
          </h2>
          <span className="text-xs text-zinc-500">
            Tri: trending score · {filteredWinners.length} produits
          </span>
        </div>

        {isLoading && !data ? (
          <WinnersSkeleton />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Rank</th>
                  <th className="px-2 py-2">Produit</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Growth</th>
                  <th className="px-2 py-2">Saturation</th>
                  <th className="px-2 py-2">Recherches</th>
                  <th className="px-2 py-2">Concurrence</th>
                  <th className="px-2 py-2">Prix</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWinners.map((row) => {
                  const hot = (row.growthRate ?? 0) > 100
                  const lowCompetition = (row.competition ?? 99) < 5
                  return (
                    <tr key={row.id} className="border-b border-zinc-100 align-middle">
                      <td className="px-2 py-3 font-mono text-xs">
                        #{row.rank}
                        {hot ? (
                          <span className="ml-1" aria-label="Hot">
                            🔥
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-xs px-2 py-3">
                        <div className="flex items-start gap-3">
                          {row.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.image}
                              alt=""
                              className="size-10 shrink-0 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                              📦
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="line-clamp-2 font-medium text-zinc-900">
                              {row.title}
                            </span>
                            <ArbitrageBadge row={row} />
                            <SupplierMatchBadge match={row.supplierMatch} />
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-zinc-600">{row.source}</td>
                      <td className="px-2 py-3">
                        {row.growthRate != null ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            +{Math.round(row.growthRate)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <SaturationCell row={row} />
                      </td>
                      <td className="px-2 py-3 text-xs text-zinc-600">
                        {formatSearches(row.searches)}
                      </td>
                      <td className="px-2 py-3 text-xs">
                        <span
                          className={
                            lowCompetition ? "font-medium text-emerald-700" : "text-red-600"
                          }
                        >
                          {competitionLabel(row.competition, country)}
                        </span>
                      </td>
                      <td className="px-2 py-3 tabular-nums font-medium text-zinc-900">
                        {formatRadarPriceDisplay(row.price ?? 0, row.currency)}
                      </td>
                      <td className="px-2 py-3">
                        {isGrossiste ? (
                          <Link
                            href="/dashboard/supplier/products/new"
                            className="text-xs font-semibold text-violet-600 hover:text-violet-800"
                          >
                            Sourcer →
                          </Link>
                        ) : (
                          <Link
                            href={`/radar/winners?country=${country}`}
                            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                          >
                            Voir concurrence →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredWinners.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Aucun winner pour ce filtre.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          📈 Trending Keywords — {country}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Mots-clés en forte croissance — mis à jour toutes les 6h.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(data?.trendingKeywords ?? []).map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-3 py-3"
            >
              <p className="text-sm font-medium text-zinc-900">{t.keyword}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-700">
                  +{Math.round(t.growthRate)}% ↗
                </span>
                {t.volume != null ? (
                  <span className="text-[10px] text-zinc-500">
                    {t.volume.toLocaleString("fr-FR")}/mois
                  </span>
                ) : null}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-violet-500"
                  style={{ width: `${Math.min(100, t.growthRate)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
