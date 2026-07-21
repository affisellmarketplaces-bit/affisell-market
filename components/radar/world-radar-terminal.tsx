"use client"

import Link from "next/link"
import useSWR from "swr"
import { useCallback, useMemo, useState } from "react"

import { RadarBulkImportModal } from "@/components/radar/RadarBulkImportModal"
import { RadarImportBar } from "@/components/radar/RadarImportBar"
import { SupplierMatchBadge } from "@/components/radar/supplier-match-badge"
import { WorldArbitrageMiniBadge } from "@/components/import/WorldArbitrageMiniBadge"
import {
  estimateBulkCatalogTotals,
  formatEnrichEuro,
  RADAR_BULK_IMPORT_MAX,
} from "@/lib/import/smart-import-enricher"
import { formatRadarPriceDisplay } from "@/lib/radar/format-radar-price"
import type { RadarImportDestination } from "@/lib/radar/radar-import-types"
import type { SupplierKind } from "@/lib/supplier-kind"
import {
  formatRelativeScanFr,
  type WorldRadarCountriesPayload,
  type WorldRadarPayload,
  type WorldRadarWinnerDto,
} from "@/lib/radar/world-radar-types"
import { toast } from "sonner"

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

function RankDelta({ row }: { row: WorldRadarWinnerDto }) {
  if (row.lastWeekRank == null) return null
  const delta = row.lastWeekRank - row.rank
  if (delta === 0) return <span className="ml-1 text-[10px] text-zinc-400">→</span>
  if (delta > 0)
    return (
      <span className="ml-1 text-[10px] font-semibold text-emerald-600" title={`était #${row.lastWeekRank}`}>
        ↑{delta}
      </span>
    )
  return (
    <span className="ml-1 text-[10px] font-semibold text-amber-600" title={`était #${row.lastWeekRank}`}>
      ↓{Math.abs(delta)}
    </span>
  )
}

function V2Badges({ row }: { row: WorldRadarWinnerDto }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {row.isNew ? (
        <span className="inline-flex animate-pulse rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800">
          🔥 Nouveau cette semaine
        </span>
      ) : null}
      {row.isHot && row.growthRate != null ? (
        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
          ⚡ +{Math.round(row.growthRate)}%
        </span>
      ) : null}
      {row.isLocalWinner ? (
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          📍 Local Winner
        </span>
      ) : null}
      {row.supplierLabel ? (
        <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600">
          {row.supplierLabel}
        </span>
      ) : null}
    </div>
  )
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(
    null
  )

  const toggleWinnerSelection = useCallback((winnerId: string) => {
    setSelectedIds((prev) =>
      prev.includes(winnerId) ? prev.filter((id) => id !== winnerId) : [...prev, winnerId]
    )
  }, [])

  const defaultBulkDestination: RadarImportDestination =
    supplierKind === "stocker" || supplierKind === "unset"
      ? "supplier_draft"
      : "affisell_catalog"

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
    const winners = [...(data?.winners ?? [])]
    winners.sort((a, b) => {
      const sa = a.finalScore ?? a.arbitrage?.score ?? a.trendingScore ?? 0
      const sb = b.finalScore ?? b.arbitrage?.score ?? b.trendingScore ?? 0
      return sb - sa
    })
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
    setSelectedIds([])
    const url = new URL(window.location.href)
    url.searchParams.set("country", code.toUpperCase())
    window.history.replaceState(null, "", url.toString())
  }, [])

  const selectedPrices = useMemo(() => {
    const byId = new Map((data?.winners ?? []).map((w) => [w.id, w.price] as const))
    return selectedIds.map((id) => byId.get(id) ?? null)
  }, [data?.winners, selectedIds])

  const bulkWinners = useMemo(
    () =>
      filteredWinners.slice(0, RADAR_BULK_IMPORT_MAX).map((w) => ({
        id: w.id,
        title: w.title,
      })),
    [filteredWinners]
  )

  const bulkTotals = useMemo(() => estimateBulkCatalogTotals(bulkWinners), [bulkWinners])

  const lastScanLabel = formatRelativeScanFr(data?.lastScanAt)
  const isLive = data?.isLive ?? false
  const isGrossiste = supplierKind === "stocker" || supplierKind === "unset"

  async function runBulkImport(destination: RadarImportDestination) {
    if (bulkLoading || bulkWinners.length === 0) return
    const total = bulkWinners.length
    setBulkLoading(true)
    setBulkProgress({ current: 0, total })

    const tick = window.setInterval(() => {
      setBulkProgress((prev) => {
        if (!prev) return { current: 1, total }
        const next = Math.min(prev.current + 1, Math.max(total - 1, 1))
        return { current: next, total }
      })
    }, 180)

    try {
      const res = await fetch("/api/radar/source", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerIds: bulkWinners.map((w) => w.id),
          country,
          destination,
        }),
      })
      const dataJson = (await res.json().catch(() => ({}))) as {
        error?: string
        jobId?: string
        count?: number
        importedCount?: number
        totalMargin?: number
        redirectUrl?: string
      }

      window.clearInterval(tick)
      setBulkProgress({ current: total, total })

      if (!res.ok) {
        toast.error(dataJson.error ?? "Import bulk impossible")
        return
      }

      const imported = dataJson.importedCount ?? dataJson.count ?? total
      const margin = dataJson.totalMargin ?? bulkTotals.marginTotal
      const jobUrl =
        dataJson.redirectUrl ??
        (dataJson.jobId ? `/dashboard/imports/${dataJson.jobId}` : null)

      if (destination === "supplier_draft" && jobUrl) {
        toast.success(`🎉 ${imported} produits prêts — ouverture assistant…`)
        setBulkModalOpen(false)
        window.location.href = jobUrl
        return
      }

      toast.success(
        `🎉 ${imported} produits importés → Marge +${formatEnrichEuro(margin)}€`,
        {
          action: {
            label: "Voir arbitrage",
            onClick: () => {
              window.location.href = jobUrl ?? "/dashboard/affiliate/catalog?filter=draft"
            },
          },
        }
      )
      setBulkModalOpen(false)
      setSelectedIds([])
      if (jobUrl && destination === "affisell_catalog") {
        window.setTimeout(() => {
          window.location.href = jobUrl
        }, 600)
      }
    } catch (err) {
      window.clearInterval(tick)
      console.error("[WorldRadarTerminal]", {
        step: "bulk_import",
        message: err instanceof Error ? err.message : "unknown",
      })
      toast.error("Erreur réseau — réessayez")
    } finally {
      setBulkLoading(false)
      setBulkProgress(null)
    }
  }

  return (
    <div className="space-y-6 pb-28">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-violet-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Affisell Intelligence
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                WORLD RADAR — Analyse quotidienne des marchés
              </h1>
              {bulkWinners.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  disabled={bulkLoading}
                  className="shrink-0 rounded-xl bg-[#6D28D9] px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-[#5B21B6] disabled:opacity-60 sm:text-sm"
                >
                  {bulkLoading && bulkProgress
                    ? `Import en cours... ${bulkProgress.current}/${bulkProgress.total}`
                    : `⚡ Importer les ${bulkWinners.length} ${country} → Catalogue (Marge +${formatEnrichEuro(bulkTotals.marginTotal)}€)`}
                </button>
              ) : null}
            </div>
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
                  <th className="px-2 py-2">
                    <span className="sr-only">Sélection</span>
                  </th>
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
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleWinnerSelection(row.id)}
                          aria-label={`Sélectionner ${row.title}`}
                          className="size-4 rounded border-zinc-300 accent-violet-600"
                        />
                      </td>
                      <td className="px-2 py-3 font-mono text-xs">
                        #{row.rank}
                        <RankDelta row={row} />
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
                            <V2Badges row={row} />
                            <ArbitrageBadge row={row} />
                            <WorldArbitrageMiniBadge row={row} />
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

      <RadarImportBar
        selectedIds={selectedIds}
        selectedPrices={selectedPrices}
        country={country}
        supplierKind={supplierKind}
        visibleCount={bulkWinners.length}
        onClear={() => setSelectedIds([])}
        onOpenBulk={() => setBulkModalOpen(true)}
        bulkProgress={bulkProgress}
        bulkLoading={bulkLoading}
      />

      <RadarBulkImportModal
        open={bulkModalOpen}
        country={country}
        winners={bulkWinners}
        defaultDestination={defaultBulkDestination}
        progress={bulkProgress}
        loading={bulkLoading}
        onClose={() => {
          if (!bulkLoading) setBulkModalOpen(false)
        }}
        onConfirm={(destination) => void runBulkImport(destination)}
      />
    </div>
  )
}
