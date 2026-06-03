"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
  Loader2,
  Rocket,
  Search,
  Sparkles,
  Store,
  Target,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  SPONSOR_DEFAULT_RATE_BPS,
  SPONSOR_DURATIONS_DAYS,
  SPONSOR_MAX_RATE_BPS,
  SPONSOR_MIN_RATE_BPS,
  SPONSOR_PLACEMENTS,
  type SponsorPlacement,
} from "@/lib/sponsor/sponsor-constants"
import { isSponsorPlacement, sponsorStatusTone } from "@/lib/sponsor/sponsor-status-ui"
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

const PLACEMENT_ICONS: Record<SponsorPlacement, typeof Store> = {
  HOME_SPOTLIGHT: Sparkles,
  CATEGORY_TOP: Store,
  SEARCH_BOOST: Search,
}

function itemKey(item: CatalogItem): string {
  return item.kind === "supplier" ? `p:${item.productId}` : `l:${item.affiliateProductId}`
}

export function SponsorBoostStudio({ role, items }: Props) {
  const t = useTranslations("sponsorBoost")
  const [selectedKey, setSelectedKey] = useState(items[0] ? itemKey(items[0]) : "")
  const [rateBps, setRateBps] = useState(SPONSOR_DEFAULT_RATE_BPS)
  const [durationDays, setDurationDays] = useState<(typeof SPONSOR_DURATIONS_DAYS)[number]>(7)
  const [placement, setPlacement] = useState<SponsorPlacement>("HOME_SPOTLIGHT")
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [paying, setPaying] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])

  const selected = useMemo(
    () => items.find((item) => itemKey(item) === selectedKey),
    [items, selectedKey]
  )

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
      alert(data.error ?? t("checkoutError"))
    } finally {
      setPaying(false)
    }
  }

  const ratePercent = rateBps / 100
  const boostRingPct = quote ? Math.min(100, Math.round((quote.boostScore / 120) * 100)) : 0
  const boostRingLen = 2 * Math.PI * 15.5

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-violet-500/20 bg-zinc-950 shadow-2xl shadow-violet-950/40">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-950/80 via-zinc-950 to-cyan-950/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 p-5 sm:p-8 lg:p-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300">
              <Zap className="size-3.5 shrink-0" aria-hidden />
              {t("eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              {role === "SUPPLIER" ? t("subtitleSupplier") : t("subtitleAffiliate")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-zinc-300 backdrop-blur-md">
            <Sparkles className="size-4 shrink-0 text-amber-300" aria-hidden />
            <span className="whitespace-nowrap">{t("liveScore")}</span>
            {quote ? (
              <span className="rounded-full bg-violet-500/25 px-2 py-0.5 font-bold tabular-nums text-violet-200">
                {quote.boostScore}
              </span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </div>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-12 xl:gap-8">
          <section className="flex flex-col gap-4 xl:col-span-5">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Target className="size-3.5" aria-hidden />
              {t("target")}
            </h2>

            {selected ? (
              <div className="flex gap-4 rounded-2xl border border-violet-400/35 bg-violet-500/10 p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 sm:size-24">
                  {selected.image ? (
                    <Image
                      src={selected.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white sm:text-base">
                    {selected.label}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-violet-200">
                    {t("htPrice", { price: formatStoreCurrencyFromCents(selected.htCents) })}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    {t("selectedSku")}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="max-h-[min(280px,40vh)] min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/25 p-2 pr-1">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-500">{t("noProducts")}</p>
              ) : (
                items.map((item) => {
                  const key = itemKey(item)
                  const active = key === selectedKey
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                        active
                          ? "border-violet-400/50 bg-violet-500/15 ring-1 ring-violet-400/30"
                          : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/5"
                      )}
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="44px"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{item.label}</p>
                        <p className="text-xs tabular-nums text-zinc-500">
                          {formatStoreCurrencyFromCents(item.htCents)} HT
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-zinc-900/90 p-5 backdrop-blur-sm sm:p-6 xl:col-span-7">
            <div>
              <div className="flex items-end justify-between gap-3">
                <label className="text-xs font-medium text-zinc-400">{t("investment")}</label>
                <span className="text-2xl font-bold tabular-nums text-white">
                  {ratePercent.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={SPONSOR_MIN_RATE_BPS}
                max={SPONSOR_MAX_RATE_BPS}
                step={50}
                value={rateBps}
                onChange={(e) => setRateBps(Number(e.target.value))}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500"
                aria-valuemin={SPONSOR_MIN_RATE_BPS / 100}
                aria-valuemax={SPONSOR_MAX_RATE_BPS / 100}
                aria-valuenow={ratePercent}
              />
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-600">
                <span>{(SPONSOR_MIN_RATE_BPS / 100).toFixed(1)}%</span>
                <span>{(SPONSOR_MAX_RATE_BPS / 100).toFixed(1)}%</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-400">{t("duration")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPONSOR_DURATIONS_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationDays(d)}
                    className={cn(
                      "min-w-[3.25rem] rounded-xl px-4 py-2 text-sm font-semibold tabular-nums transition",
                      durationDays === d
                        ? "bg-violet-500 text-white shadow-lg shadow-violet-900/40"
                        : "border border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-violet-500/40"
                    )}
                  >
                    {d}
                    <span className="ml-0.5 text-[10px] font-medium opacity-80">j</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-400">{t("placement.label")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {SPONSOR_PLACEMENTS.map((p) => {
                  const Icon = PLACEMENT_ICONS[p]
                  const active = placement === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlacement(p)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left transition",
                        active
                          ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-50"
                          : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-cyan-300" : "text-zinc-500")} aria-hidden />
                      <span className="text-xs font-semibold leading-tight">{t(`placement.${p}`)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/25 to-zinc-900 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
                  {t("budget")}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white sm:text-4xl">
                  {loadingQuote ? (
                    <Loader2 className="inline size-8 animate-spin text-violet-300" aria-hidden />
                  ) : quote ? (
                    formatStoreCurrencyFromCents(quote.feeCents)
                  ) : (
                    "—"
                  )}
                </p>
                {quote ? (
                  <p className="mt-2 text-xs text-zinc-400">
                    {t("quoteMeta", {
                      score: quote.boostScore,
                      rate: quote.ratePercent,
                      days: quote.durationDays,
                    })}
                  </p>
                ) : null}
              </div>

              {quote ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 py-3 sm:min-w-[7rem]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                    {t("boostPower")}
                  </span>
                  <div
                    className="relative mt-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-500/40"
                    role="img"
                    aria-label={t("boostPowerAria", { score: quote.boostScore })}
                  >
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        className="stroke-zinc-800"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        className="stroke-violet-400 transition-all duration-500"
                        strokeWidth="3"
                        strokeDasharray={`${(boostRingPct / 100) * boostRingLen} ${boostRingLen}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="relative text-sm font-bold tabular-nums text-violet-200">
                      {quote.boostScore}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              disabled={!selected || paying || !quote}
              onClick={() => void launchBoost()}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 text-base font-semibold text-white shadow-lg shadow-violet-900/50 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-40"
            >
              {paying ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <>
                  <Rocket className="mr-2 size-5 shrink-0" aria-hidden />
                  {t("cta")}
                </>
              )}
            </Button>
          </section>
        </div>

        {campaigns.length > 0 ? (
          <section className="relative z-10 mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t("recentCampaigns")}
            </h2>
            <ul className="mt-4 space-y-2">
              {campaigns.slice(0, 6).map((c) => {
                const label =
                  c.affiliateProduct?.customTitle ??
                  c.affiliateProduct?.product.name ??
                  c.product.name
                const tone = sponsorStatusTone(c.status)
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-100">{label}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide",
                          tone === "amber" && "border-amber-500/40 bg-amber-500/15 text-amber-200",
                          tone === "emerald" &&
                            "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
                          tone === "rose" && "border-rose-500/40 bg-rose-500/15 text-rose-200",
                          tone === "zinc" && "border-zinc-600 bg-zinc-800 text-zinc-400"
                        )}
                      >
                        {t(`status.${c.status}`, { defaultValue: c.status })}
                      </span>
                      <span className="text-zinc-500">
                        {isSponsorPlacement(c.placement)
                          ? t(`placement.${c.placement}`)
                          : c.placement}
                      </span>
                      <span className="font-semibold tabular-nums text-zinc-200">
                        {formatStoreCurrencyFromCents(c.feeCents)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
