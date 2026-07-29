"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  Radio,
  Swords,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { affisellBrand } from "@/lib/affisell-brand"
import {
  BATTLES_ARENA_HREF,
  type BattlesHubCard,
  type BattlesHubPayload,
  type BattlesHubProduct,
} from "@/lib/battles-hub-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

type Props = {
  initial: BattlesHubPayload
}

const POLL_MS = 5_000

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${String(m % 60).padStart(2, "0")}m`
  }
  return `${m}:${String(r).padStart(2, "0")}`
}

function ProductThumb({
  product,
  side,
  winner,
}: {
  product: BattlesHubProduct
  side: "A" | "B"
  winner?: boolean
}) {
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col items-center gap-2 rounded-2xl border p-3",
        winner
          ? "border-amber-400/60 bg-amber-500/10 ring-1 ring-amber-400/30"
          : side === "A"
            ? "border-amber-500/25 bg-amber-500/5"
            : "border-violet-500/25 bg-violet-500/5"
      )}
    >
      {winner ? (
        <span className="absolute -top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-950">
          <Trophy className="size-2.5" aria-hidden />
          Win
        </span>
      ) : null}
      <span className="relative size-20 overflow-hidden rounded-xl bg-white/5 sm:size-24">
        {product.image ? (
          <Image
            src={product.image}
            alt=""
            fill
            className="object-cover"
            sizes="96px"
            unoptimized
          />
        ) : (
          <span className="flex size-full items-center justify-center text-xs text-white/30">
            —
          </span>
        )}
      </span>
      <p className="line-clamp-2 text-center text-xs font-semibold text-white/90">
        {product.name}
      </p>
      <p className="text-[11px] tabular-nums text-white/55">
        {formatStoreCurrencyFromCents(product.priceCents)}
      </p>
    </div>
  )
}

function BattleDuelCard({
  battle,
  accent = "live",
  ctaHref,
  ctaLabel,
}: {
  battle: BattlesHubCard
  accent?: "live" | "upcoming" | "recent"
  ctaHref: string
  ctaLabel: string
}) {
  const t = useTranslations("battles")
  const winnerIsA = battle.winnerId === battle.productA.id
  const winnerIsB = battle.winnerId === battle.productB.id
  const flashActive = battle.flashTimeLeftMs > 0

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border p-4 sm:p-5",
        accent === "live" &&
          "battles-hub-live-glow border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-950/50 via-zinc-950/80 to-violet-950/40",
        accent === "upcoming" &&
          "border-white/10 bg-white/[0.04] backdrop-blur-md",
        accent === "recent" && "border-white/8 bg-white/[0.03]"
      )}
      data-testid={`battles-hub-card-${battle.id}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {accent === "live" && battle.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              {t("live")}
            </span>
          ) : null}
          {flashActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/30">
              <Zap className="size-3" aria-hidden />
              −{battle.flashDiscount}% {t("flash")}
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
              −{battle.flashDiscount}%
            </span>
          )}
          {battle.status === "scheduled" ? (
            <span className="text-[10px] font-medium text-white/50">{t("upcoming")}</span>
          ) : null}
          {battle.status === "ended" && !flashActive ? (
            <span className="text-[10px] font-medium text-white/50">{t("ended")}</span>
          ) : null}
        </div>
        {battle.timeLeftMs > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-fuchsia-200">
            <Timer className="size-3.5" aria-hidden />
            {formatCountdown(battle.timeLeftMs)}
          </span>
        ) : flashActive ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-emerald-200">
            <Timer className="size-3.5" aria-hidden />
            {formatCountdown(battle.flashTimeLeftMs)}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <ProductThumb product={battle.productA} side="A" winner={winnerIsA} />
        <div className="flex flex-col items-center gap-1 px-1">
          <Swords className="size-5 text-fuchsia-300/90" aria-hidden />
          <div className="w-16 overflow-hidden rounded-full bg-white/10 sm:w-20">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-violet-400"
              style={{ width: `${battle.pctA}%` }}
            />
          </div>
          <p className="text-[10px] tabular-nums text-white/60">
            {battle.pctA}% · {battle.pctB}%
          </p>
          <p className="text-[9px] text-white/40">
            {t("votes", { count: battle.totalVoters })}
          </p>
        </div>
        <ProductThumb product={battle.productB} side="B" winner={winnerIsB} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={ctaHref}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition",
            accent === "live"
              ? "bg-white text-zinc-950 hover:bg-fuchsia-100"
              : "border border-white/20 bg-white/10 text-white hover:bg-white/15"
          )}
        >
          {ctaLabel}
        </Link>
        {battle.productA.affiliateProductId ? (
          <Link
            href={`/marketplace/${battle.productA.affiliateProductId}?battleId=${encodeURIComponent(battle.id)}`}
            className="inline-flex items-center rounded-full px-3 py-2.5 text-xs font-medium text-white/70 hover:text-white"
          >
            {t("viewA")}
          </Link>
        ) : null}
        {battle.productB.affiliateProductId ? (
          <Link
            href={`/marketplace/${battle.productB.affiliateProductId}?battleId=${encodeURIComponent(battle.id)}`}
            className="inline-flex items-center rounded-full px-3 py-2.5 text-xs font-medium text-white/70 hover:text-white"
          >
            {t("viewB")}
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export function BattlesHubExperience({ initial }: Props) {
  const t = useTranslations("battles")
  const [payload, setPayload] = useState(initial)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pulse/battle/list", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as BattlesHubPayload & { ok?: boolean }
      setPayload({
        live: data.live ?? null,
        upcoming: data.upcoming ?? [],
        recent: data.recent ?? [],
        generatedAt: data.generatedAt ?? new Date().toISOString(),
      })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  /** Local countdown decay between polls. */
  const liveDisplay = useMemo(() => {
    void tick
    if (!payload.live) return null
    const b = { ...payload.live }
    if (b.status === "live" && b.endedAt) {
      b.timeLeftMs = Math.max(0, new Date(b.endedAt).getTime() - Date.now())
    }
    if (b.flashEndsAt) {
      b.flashTimeLeftMs = Math.max(0, new Date(b.flashEndsAt).getTime() - Date.now())
    }
    return b
  }, [payload.live, tick])

  const tickerItems = useMemo(() => {
    const items: string[] = []
    if (liveDisplay?.status === "live") {
      items.push(
        `${liveDisplay.productA.name.slice(0, 22)} vs ${liveDisplay.productB.name.slice(0, 22)} · −${liveDisplay.flashDiscount}%`
      )
    }
    for (const r of payload.recent.slice(0, 4)) {
      const winner =
        r.winnerId === r.productA.id
          ? r.productA.name
          : r.winnerId === r.productB.id
            ? r.productB.name
            : "—"
      items.push(`${t("winner")}: ${winner.slice(0, 28)} · −${r.flashDiscount}%`)
    }
    if (items.length === 0) return [t("tickerEmpty")]
    return [...items, ...items]
  }, [liveDisplay, payload.recent, t])

  const empty =
    !liveDisplay && payload.upcoming.length === 0 && payload.recent.length === 0

  return (
    <div className="affisell-battles-hub" data-testid="battles-hub">
      <div className="affisell-battles-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />

      <header
        className={cn(
          affisellBrand.epoxySurface,
          "relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
        )}
      >
        <Link
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-300/90">
            {t("eyebrow")}
          </p>
          <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
            {t("title")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {liveDisplay?.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <Radio className="size-3" aria-hidden />
              {t("live")}
            </span>
          ) : (
            <span className="size-8" aria-hidden />
          )}
        </div>
      </header>

      <div className="relative z-10 overflow-hidden border-y border-white/10 bg-black/30 py-2">
        <div className="affisell-battles-ticker flex w-max gap-8 whitespace-nowrap px-4 text-[11px] font-medium text-white/55">
          {tickerItems.map((line, i) => (
            <span key={`${line}-${i}`}>{line}</span>
          ))}
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <p className="max-w-xl text-sm text-white/65">{t("subtitle")}</p>

        <AnimatePresence mode="wait">
          {empty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center"
            >
              <Swords className="mx-auto size-10 text-fuchsia-400/70" aria-hidden />
              <p className="mt-4 text-sm text-white/70">{t("empty")}</p>
              <Link
                href="/discover"
                className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-fuchsia-100"
              >
                {t("goPulse")}
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {liveDisplay ? (
                <section aria-labelledby="battles-live-heading" className="space-y-3">
                  <h2
                    id="battles-live-heading"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300/90"
                  >
                    {liveDisplay.status === "live" ? t("sectionLive") : t("sectionFlash")}
                  </h2>
                  <BattleDuelCard
                    battle={liveDisplay}
                    accent="live"
                    ctaHref={BATTLES_ARENA_HREF}
                    ctaLabel={
                      liveDisplay.status === "live" ? t("enterArena") : t("shopFlash")
                    }
                  />
                </section>
              ) : null}

              {payload.upcoming.length > 0 ? (
                <section aria-labelledby="battles-upcoming-heading" className="space-y-3">
                  <h2
                    id="battles-upcoming-heading"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50"
                  >
                    {t("sectionUpcoming")}
                  </h2>
                  <ul className="grid gap-4 lg:grid-cols-2">
                    {payload.upcoming.map((b) => (
                      <li key={b.id}>
                        <BattleDuelCard
                          battle={b}
                          accent="upcoming"
                          ctaHref={BATTLES_ARENA_HREF}
                          ctaLabel={t("watchArena")}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {payload.recent.length > 0 ? (
                <section aria-labelledby="battles-recent-heading" className="space-y-3">
                  <h2
                    id="battles-recent-heading"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50"
                  >
                    {t("sectionRecent")}
                  </h2>
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {payload.recent.map((b) => (
                      <li key={b.id}>
                        <BattleDuelCard
                          battle={b}
                          accent="recent"
                          ctaHref={
                            b.winnerId === b.productA.id && b.productA.affiliateProductId
                              ? `/marketplace/${b.productA.affiliateProductId}?battleId=${encodeURIComponent(b.id)}`
                              : b.winnerId === b.productB.id && b.productB.affiliateProductId
                                ? `/marketplace/${b.productB.affiliateProductId}?battleId=${encodeURIComponent(b.id)}`
                                : BATTLES_ARENA_HREF
                          }
                          ctaLabel={t("seeWinner")}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
