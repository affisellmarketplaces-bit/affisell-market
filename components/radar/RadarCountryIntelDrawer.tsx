"use client"

import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Radar, X } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"

import { getConnectorById } from "@/lib/radar/connectors/registry"
import { countryCodeToName, type CountryMapStat } from "@/lib/radar/map/geo"
import { cn } from "@/lib/utils"

type IntelProduct = {
  id: string
  title: string
  marketplaceId: string
  country: string
  price: number
  currency: string | null
  rank: number | null
  salesEst: number | null
  url: string | null
  imageUrl: string | null
}

type IntelPayload = {
  country: string
  count: number
  products: IntelProduct[]
  demo: boolean
  priceVeiled?: boolean
}

type Props = {
  open: boolean
  stat: CountryMapStat | null
  onClose: () => void
}

export function RadarCountryIntelDrawer({ open, stat, onClose }: Props) {
  const titleId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intel, setIntel] = useState<IntelPayload | null>(null)
  const [marketFilter, setMarketFilter] = useState<string | "all">("all")

  useEffect(() => {
    if (!open || !stat) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setIntel(null)
    setMarketFilter("all")

    void (async () => {
      try {
        const res = await fetch(
          `/api/radar/map/country?country=${encodeURIComponent(stat.country)}&take=80`
        )
        const data = (await res.json().catch(() => null)) as
          | (IntelPayload & { error?: string })
          | null
        if (cancelled) return
        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || `http_${res.status}`)
        }
        setIntel(data)
        console.log("[radar/map-intel]", {
          event: "country_open",
          country: data.country,
          count: data.count,
          returned: data.products.length,
          demo: data.demo,
          mix: data.products.reduce<Record<string, number>>((acc, p) => {
            const k = p.marketplaceId
            acc[k] = (acc[k] ?? 0) + 1
            return acc
          }, {}),
        })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "load_failed"
        setError(message)
        console.error("[radar/map-intel]", { event: "load_failed", error: message })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, stat])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const marketMix = useMemo(() => {
    if (!intel) return [] as Array<{ id: string; count: number; label: string }>
    const counts = new Map<string, number>()
    for (const p of intel.products) {
      counts.set(p.marketplaceId, (counts.get(p.marketplaceId) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: getConnectorById(id)?.name ?? id,
      }))
      .sort((a, b) => b.count - a.count)
  }, [intel])

  const visibleProducts = useMemo(() => {
    if (!intel) return []
    if (marketFilter === "all") return intel.products
    return intel.products.filter((p) => p.marketplaceId === marketFilter)
  }, [intel, marketFilter])

  if (!open || !stat) return null

  const displayCount = intel?.count ?? stat.count
  const name = countryCodeToName(stat.country)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-l border-emerald-500/20",
          "bg-[#070b14] text-zinc-100 shadow-2xl shadow-emerald-500/10",
          "translate-x-0 transition-transform duration-300 ease-out"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.22),transparent_70%)]" />

        <header className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              <Radar className="size-3.5" aria-hidden />
              Country Intel · 24h
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-black tracking-tight text-white">
              {name}{" "}
              <span className="font-mono text-sm font-semibold text-zinc-400">({stat.country})</span>
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              <span className="font-semibold tabular-nums text-emerald-300">
                {displayCount.toLocaleString("fr-FR")}
              </span>{" "}
              produits Radar (snapshots) — pas le catalogue Affisell
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        {stat.topProductTitle ? (
          <div className="relative z-10 mx-5 mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs">
            <p className="font-semibold uppercase tracking-wide text-emerald-300">Top signal</p>
            <p className="mt-1 line-clamp-2 text-zinc-100">{stat.topProductTitle}</p>
          </div>
        ) : null}

        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <ul className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </ul>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
              Impossible de charger les winners Radar ({error}).
            </p>
          ) : null}

          {intel && !loading ? (
            <>
              {intel.demo ? (
                <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100">
                  Mode demo — échantillon. Le compteur map reste la référence 24h.
                </p>
              ) : null}
              {marketMix.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMarketFilter("all")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      marketFilter === "all"
                        ? "bg-emerald-400 text-zinc-950"
                        : "bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200"
                    )}
                  >
                    All · {intel.products.length}
                  </button>
                  {marketMix.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMarketFilter(m.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold",
                        marketFilter === m.id
                          ? "bg-cyan-400 text-zinc-950"
                          : "bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200"
                      )}
                    >
                      {m.label} · {m.count}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="mb-3 text-[11px] text-zinc-500">
                Affichage {visibleProducts.length.toLocaleString("fr-FR")}
                {marketFilter === "all"
                  ? ` / ${displayCount.toLocaleString("fr-FR")}`
                  : ""}{" "}
                · mix multi-market (cap Amazon) · tri demande
              </p>
              <ul className="space-y-2">
                {visibleProducts.map((p, idx) => {
                  const connector = getConnectorById(p.marketplaceId)
                  const body = (
                    <>
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10">
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-lg">
                            {connector?.logo ?? "◈"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-zinc-50">{p.title}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          #{idx + 1}
                          {p.rank != null ? ` · rank ${p.rank}` : ""}
                          {" · "}
                          {connector?.name ?? p.marketplaceId}
                          {p.salesEst != null
                            ? ` · demande ${p.salesEst.toLocaleString("fr-FR")}`
                            : ""}
                        </p>
                      </div>
                      {p.url ? (
                        <ExternalLink className="mt-1 size-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                      ) : null}
                    </>
                  )

                  return (
                    <li key={p.id}>
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
                        >
                          {body}
                        </a>
                      ) : (
                        <div className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                          {body}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {visibleProducts.length === 0 ? (
                <p className="text-sm text-zinc-400">Aucun snapshot 24h pour ce filtre.</p>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="relative z-10 border-t border-white/10 px-5 py-4">
          <Link
            href={`/radar/winners?country=${encodeURIComponent(stat.country)}`}
            className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20"
            onClick={onClose}
          >
            Voir la liste complète ({displayCount.toLocaleString("fr-FR")})
          </Link>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Liens externes = marketplaces crawlées · marge Affisell jamais exposée ici
          </p>
        </footer>
      </aside>
    </div>
  )
}
