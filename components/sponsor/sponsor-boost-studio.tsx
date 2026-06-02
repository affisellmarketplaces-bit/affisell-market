"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Rocket, Sparkles, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  SPONSOR_DEFAULT_RATE_BPS,
  SPONSOR_DURATIONS_DAYS,
  SPONSOR_MAX_RATE_BPS,
  SPONSOR_MIN_RATE_BPS,
  SPONSOR_PLACEMENT_LABELS,
  SPONSOR_PLACEMENTS,
  type SponsorPlacement,
} from "@/lib/sponsor/sponsor-constants"
import { cn } from "@/lib/utils"

type CatalogItem =
  | {
      kind: "supplier"
      productId: string
      label: string
      image: string | null
      htCents: number
    }
  | {
      kind: "affiliate"
      affiliateProductId: string
      productId: string
      label: string
      image: string | null
      htCents: number
    }

type Quote = {
  feeCents: number
  ratePercent: number
  durationDays: number
  placement: SponsorPlacement
  boostScore: number
}

type CampaignRow = {
  id: string
  status: string
  placement: string
  feeCents: number
  sponsorRateBps: number
  durationDays: number
  endsAt: string | null
  product: { name: string }
  affiliateProduct: { customTitle: string | null; product: { name: string } } | null
}

type Props = {
  role: "SUPPLIER" | "AFFILIATE"
  items: CatalogItem[]
}

export function SponsorBoostStudio({ role, items }: Props) {
  const [selectedKey, setSelectedKey] = useState(
    items[0]
      ? items[0].kind === "supplier"
        ? `p:${items[0].productId}`
        : `l:${items[0].affiliateProductId}`
      : ""
  )
  const [rateBps, setRateBps] = useState(SPONSOR_DEFAULT_RATE_BPS)
  const [durationDays, setDurationDays] = useState<(typeof SPONSOR_DURATIONS_DAYS)[number]>(7)
  const [placement, setPlacement] = useState<SponsorPlacement>("HOME_SPOTLIGHT")
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [paying, setPaying] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])

  const selected = useMemo(() => {
    return items.find((item) =>
      item.kind === "supplier"
        ? `p:${item.productId}` === selectedKey
        : `l:${item.affiliateProductId}` === selectedKey
    )
  }, [items, selectedKey])

  const loadCampaigns = useCallback(async () => {
    const res = await fetch("/api/sponsor/campaigns")
    if (!res.ok) return
    const data = (await res.json()) as { campaigns: CampaignRow[] }
    setCampaigns(data.campaigns ?? [])
  }, [])

  useEffect(() => {
    void loadCampaigns()
  }, [loadCampaigns])

  useEffect(() => {
    if (!selected) {
      setQuote(null)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      setLoadingQuote(true)
      try {
        const body =
          selected.kind === "supplier"
            ? { productId: selected.productId, sponsorRateBps: rateBps, durationDays, placement }
            : {
                affiliateProductId: selected.affiliateProductId,
                sponsorRateBps: rateBps,
                durationDays,
                placement,
              }
        const res = await fetch("/api/sponsor/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const data = await res.json()
        if (res.ok && data.quote) setQuote(data.quote as Quote)
      } finally {
        setLoadingQuote(false)
      }
    }
    void run()
    return () => controller.abort()
  }, [selected, rateBps, durationDays, placement])

  async function launchBoost() {
    if (!selected) return
    setPaying(true)
    try {
      const body =
        selected.kind === "supplier"
          ? { productId: selected.productId, sponsorRateBps: rateBps, durationDays, placement }
          : {
              affiliateProductId: selected.affiliateProductId,
              sponsorRateBps: rateBps,
              durationDays,
              placement,
            }
      const res = await fetch("/api/sponsor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url as string
        return
      }
      alert(data.error ?? "Erreur paiement")
    } finally {
      setPaying(false)
    }
  }

  const ratePercent = rateBps / 100

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-violet-500/20 bg-gradient-to-br from-zinc-950 via-violet-950/40 to-cyan-950/30 p-6 shadow-2xl shadow-violet-900/30 sm:p-10">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            <Sparkles className="size-3.5" aria-hidden />
            Affisell Promote
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Mise en avant intelligente
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            {role === "SUPPLIER"
              ? "Boostez votre catalogue sur toutes les boutiques affiliées. Vous payez un % du prix HT — placement premium instantané."
              : "Propulsez votre listing en tête du marketplace. Commission sur prix HT fournisseur, ROI mesurable en temps réel."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 backdrop-blur">
          <Zap className="size-4 text-amber-300" aria-hidden />
          Algorithme boost · score live
        </div>
      </header>

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Cible</h2>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucun produit éligible.</p>
            ) : (
              items.map((item) => {
                const key =
                  item.kind === "supplier"
                    ? `p:${item.productId}`
                    : `l:${item.affiliateProductId}`
                const active = key === selectedKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
                      active
                        ? "border-violet-400/60 bg-violet-500/15 shadow-lg shadow-violet-900/20"
                        : "border-white/10 bg-white/5 hover:border-violet-400/30"
                    )}
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt=""
                        className="size-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="size-12 rounded-xl bg-zinc-800" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-zinc-400">
                        HT {formatStoreCurrencyFromCents(item.htCents)}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
          <div>
            <label className="text-xs font-medium text-zinc-400">
              Investissement HT · {ratePercent.toFixed(1)}%
            </label>
            <input
              type="range"
              min={SPONSOR_MIN_RATE_BPS}
              max={SPONSOR_MAX_RATE_BPS}
              step={50}
              value={rateBps}
              onChange={(e) => setRateBps(Number(e.target.value))}
              className="mt-2 w-full accent-violet-400"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-400">Durée</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPONSOR_DURATIONS_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    durationDays === d
                      ? "bg-white text-zinc-900"
                      : "border border-white/15 text-zinc-300 hover:border-violet-400/40"
                  )}
                >
                  {d} j
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-400">Placement</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {SPONSOR_PLACEMENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlacement(p)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-left text-xs font-medium transition",
                    placement === p
                      ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 text-zinc-400 hover:border-white/25"
                  )}
                >
                  {SPONSOR_PLACEMENT_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-600/20 to-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-wider text-violet-200">Budget estimé</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {loadingQuote ? (
                <Loader2 className="inline size-7 animate-spin" />
              ) : quote ? (
                formatStoreCurrencyFromCents(quote.feeCents)
              ) : (
                "—"
              )}
            </p>
            {quote ? (
              <p className="mt-1 text-xs text-zinc-400">
                Score boost {quote.boostScore} · {quote.ratePercent}% HT · {quote.durationDays} jours
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            disabled={!selected || paying || !quote}
            onClick={() => void launchBoost()}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-400 text-base font-semibold text-white hover:from-violet-400 hover:to-cyan-300"
          >
            {paying ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <Rocket className="mr-2 size-5" aria-hidden />
                Activer Promote
              </>
            )}
          </Button>
        </section>
      </div>

      {campaigns.length > 0 ? (
        <section className="relative z-10 mt-10 border-t border-white/10 pt-8">
          <h2 className="text-sm font-semibold text-zinc-300">Campagnes récentes</h2>
          <ul className="mt-4 space-y-2">
            {campaigns.slice(0, 6).map((c) => {
              const label =
                c.affiliateProduct?.customTitle ??
                c.affiliateProduct?.product.name ??
                c.product.name
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-white">{label}</span>
                  <span className="text-zinc-400">
                    {c.status} · {SPONSOR_PLACEMENT_LABELS[c.placement as SponsorPlacement] ?? c.placement} ·{" "}
                    {formatStoreCurrencyFromCents(c.feeCents)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
