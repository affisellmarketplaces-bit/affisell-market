"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Radio, Swords, Timer, Trophy, Zap } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { affisellBrand } from "@/lib/affisell-brand"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import {
  BATTLES_ARENA_HREF,
  type BattlesHubCard,
  type BattlesHubPayload,
  type BattlesHubProduct,
} from "@/lib/battles-hub-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
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

function statusLabel(
  battle: BattlesHubCard,
  t: ReturnType<typeof useTranslations<"battles">>
): string {
  if (battle.status === "live") return t("live")
  if (battle.status === "scheduled") return t("upcoming")
  if (battle.flashTimeLeftMs > 0) return t("flash")
  return t("ended")
}

/**
 * Arena-style half — full-bleed product image like /pulse/battle.
 * Mobile-first density: stacked CTAs, clamped titles, compact thumbs.
 */
function ArenaHalf({
  product,
  votes,
  pct,
  side,
  isWinner,
  flashDiscount,
  detailsHref,
  voteHref,
  size,
  showVoteCta,
}: {
  product: BattlesHubProduct
  votes: number
  pct: number
  side: "A" | "B"
  isWinner: boolean
  flashDiscount: number
  detailsHref: string | null
  voteHref: string
  size: "hero" | "rail"
  showVoteCta: boolean
}) {
  const t = useTranslations("battles")
  const leading = pct >= 50

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden border-white/10",
        side === "A" ? "border-r" : "border-l",
        isWinner && "ring-2 ring-inset ring-emerald-400/80"
      )}
    >
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/80"
        aria-hidden
      />

      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col items-center justify-center gap-1.5 px-2 text-center sm:gap-3 sm:px-4",
          size === "hero" ? "py-5 sm:py-12" : "py-4 sm:py-6"
        )}
      >
        {isWinner ? (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black sm:px-3 sm:py-1 sm:text-[10px]">
            <Trophy className="size-2.5 shrink-0 sm:size-3" aria-hidden />
            <span className="truncate">{t("winnerBadge", { pct: flashDiscount })}</span>
          </span>
        ) : null}

        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt=""
            className={cn(
              "rounded-xl object-cover shadow-2xl ring-1 ring-white/20 sm:rounded-2xl",
              size === "hero"
                ? "h-[4.5rem] w-[4.5rem] sm:h-40 sm:w-40"
                : "h-14 w-14 sm:h-24 sm:w-24"
            )}
          />
        ) : null}

        <h3
          className={cn(
            "max-w-[96%] font-bold leading-snug text-white line-clamp-2 sm:line-clamp-3",
            size === "hero" ? "text-[11px] sm:text-lg" : "text-[10px] sm:text-sm"
          )}
        >
          {product.name}
        </h3>
        <p className="text-xs font-semibold tabular-nums text-white/80 sm:text-base sm:font-normal sm:text-white/75">
          {formatStoreCurrencyFromCents(product.priceCents)}
        </p>
        <p className="hidden max-w-[96%] truncate text-[9px] uppercase tracking-wider text-white/40 sm:block sm:text-[10px]">
          {product.category}
        </p>

        <div className="mt-1 flex w-full max-w-[9.5rem] flex-col items-stretch gap-1.5 px-0.5 sm:mt-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
          {showVoteCta ? (
            <Link
              href={voteHref}
              className="inline-flex h-9 w-full items-center justify-center rounded-full bg-white px-3 text-[11px] font-black tracking-wide text-black transition active:scale-[0.98] hover:bg-zinc-100 sm:h-12 sm:min-w-[9rem] sm:w-auto sm:px-5 sm:text-sm"
            >
              {t("voteCta")}
            </Link>
          ) : null}
          {detailsHref ? (
            <Link
              href={detailsHref}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-3 text-[11px] font-bold text-white backdrop-blur-sm transition active:scale-[0.98] hover:bg-white/15 sm:w-auto sm:px-5 sm:text-sm",
                showVoteCta ? "h-9 sm:h-12 sm:min-w-[9rem]" : "h-8 sm:h-9"
              )}
            >
              {t("detailsCta")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="mb-0.5 flex justify-between text-[9px] font-semibold text-white/70 sm:mb-1 sm:text-[10px]">
          <span>{t("votes", { count: votes })}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15 sm:h-2">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              leading ? "bg-emerald-400" : "bg-white/40"
            )}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Netflix / Pulse Arena VS board — preferred product battle display.
 */
function ArenaDuelBoard({
  battle,
  size = "rail",
}: {
  battle: BattlesHubCard
  size?: "hero" | "rail"
}) {
  const t = useTranslations("battles")
  const winnerIsA = battle.winnerId === battle.productA.id
  const winnerIsB = battle.winnerId === battle.productB.id
  const flashActive = battle.flashTimeLeftMs > 0
  const showVoteCta = battle.status !== "ended"
  const detailsA = battle.productA.affiliateProductId
    ? `/marketplace/${battle.productA.affiliateProductId}?battleId=${encodeURIComponent(battle.id)}`
    : null
  const detailsB = battle.productB.affiliateProductId
    ? `/marketplace/${battle.productB.affiliateProductId}?battleId=${encodeURIComponent(battle.id)}`
    : null

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40 sm:rounded-2xl",
        size === "hero" && "battles-hub-live-glow border-fuchsia-400/25"
      )}
      data-testid={`battles-hub-card-${battle.id}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 bg-black/90 px-2.5 py-2 sm:items-center sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3">
          <span className="inline-flex max-w-full items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white sm:text-[10px] sm:tracking-[0.14em]">
            {battle.status === "live" ? (
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
            ) : (
              <span className="size-1.5 shrink-0 rounded-full bg-white/35" aria-hidden />
            )}
            <span className="truncate">
              <span className="hidden sm:inline">Pulse Battle • </span>
              {statusLabel(battle, t)}
            </span>
          </span>
          <span className="text-[9px] text-white/50 sm:text-[10px]">
            {t("voters", { count: battle.totalVoters })}
          </span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/80 sm:px-2">
            −{battle.flashDiscount}%
          </span>
          {flashActive ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300">
              <Zap className="size-3" aria-hidden />
              {t("flash")}
            </span>
          ) : null}
        </div>
        {battle.timeLeftMs > 0 && battle.status === "live" ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tabular-nums text-white/80 sm:text-[11px]">
            <Timer className="size-3" aria-hidden />
            {formatCountdown(battle.timeLeftMs)}
          </span>
        ) : flashActive ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tabular-nums text-emerald-200 sm:text-[11px]">
            <Timer className="size-3" aria-hidden />
            {formatCountdown(battle.flashTimeLeftMs)}
          </span>
        ) : battle.status === "scheduled" ? (
          <span className="hidden shrink-0 text-[11px] font-medium text-white/70 sm:inline">
            {t("soonPulse")}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "relative grid grid-cols-2",
          size === "hero"
            ? "min-h-[min(58dvh,420px)] sm:min-h-[min(72vh,680px)]"
            : "min-h-[240px] sm:min-h-[360px]"
        )}
      >
        <ArenaHalf
          product={battle.productA}
          votes={battle.votesA}
          pct={battle.pctA}
          side="A"
          isWinner={winnerIsA}
          flashDiscount={battle.flashDiscount}
          detailsHref={detailsA}
          voteHref={BATTLES_ARENA_HREF}
          size={size}
          showVoteCta={showVoteCta}
        />
        <ArenaHalf
          product={battle.productB}
          votes={battle.votesB}
          pct={battle.pctB}
          side="B"
          isWinner={winnerIsB}
          flashDiscount={battle.flashDiscount}
          detailsHref={detailsB}
          voteHref={BATTLES_ARENA_HREF}
          size={size}
          showVoteCta={showVoteCta}
        />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-black text-zinc-950 shadow-xl ring-4 ring-black/50 sm:size-14 sm:text-base"
          aria-hidden
        >
          VS
        </div>
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

  const [tick, setTick] = useState(0)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    setNowMs(Date.now())
    const id = window.setInterval(() => {
      setTick((n) => n + 1)
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const liveDisplay = useMemo(() => {
    void tick
    if (!payload.live) return null
    const b = { ...payload.live }
    if (b.status === "live" && b.endedAt) {
      b.timeLeftMs = Math.max(0, new Date(b.endedAt).getTime() - nowMs)
    }
    if (b.flashEndsAt) {
      b.flashTimeLeftMs = Math.max(0, new Date(b.flashEndsAt).getTime() - nowMs)
    }
    return b
  }, [payload.live, tick, nowMs])

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
          "relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3"
        )}
      >
        <Link
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white sm:min-w-0 sm:justify-start sm:px-1"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{t("back")}</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300/90 sm:text-[10px] sm:tracking-[0.22em]">
            {t("eyebrow")}
          </p>
          <h1 className="truncate text-base font-black tracking-tight text-white sm:text-xl">
            {t("title")}
          </h1>
        </div>
        <div className="flex min-w-9 items-center justify-end gap-2 sm:min-w-[4.5rem]">
          {liveDisplay?.status === "live" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white sm:gap-1.5 sm:px-2.5 sm:text-[10px]">
              <Radio className="size-3" aria-hidden />
              {t("live")}
            </span>
          ) : (
            <span className="size-8" aria-hidden />
          )}
        </div>
      </header>

      <div className="relative z-10 overflow-hidden border-y border-white/10 bg-black/30 py-1.5 sm:py-2">
        <div className="affisell-battles-ticker flex w-max gap-8 whitespace-nowrap px-3 text-[10px] font-medium text-white/55 sm:px-4 sm:text-[11px]">
          {tickerItems.map((line, i) => (
            <span key={`${line}-${i}`}>{line}</span>
          ))}
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:space-y-8 sm:px-6 sm:py-8">
        <p className="max-w-xl text-pretty text-xs leading-relaxed text-white/65 sm:text-sm">
          {t("subtitle")}
        </p>

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
              className="space-y-6 sm:space-y-10"
            >
              {liveDisplay ? (
                <section aria-labelledby="battles-live-heading" className="space-y-2 sm:space-y-3">
                  <h2
                    id="battles-live-heading"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/90 sm:text-xs"
                  >
                    {liveDisplay.status === "live" ? t("sectionLive") : t("sectionFlash")}
                  </h2>
                  <ArenaDuelBoard battle={liveDisplay} size="hero" />
                </section>
              ) : null}

              {payload.upcoming.length > 0 ? (
                <section aria-labelledby="battles-upcoming-heading" className="space-y-2 sm:space-y-3">
                  <h2
                    id="battles-upcoming-heading"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 sm:text-xs"
                  >
                    {t("sectionUpcoming")}
                  </h2>
                  <ul className="grid gap-3 sm:gap-5">
                    {payload.upcoming.map((b) => (
                      <li key={b.id}>
                        <ArenaDuelBoard battle={b} size="rail" />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {payload.recent.length > 0 ? (
                <section aria-labelledby="battles-recent-heading" className="space-y-2 sm:space-y-3">
                  <h2
                    id="battles-recent-heading"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 sm:text-xs"
                  >
                    {t("sectionRecent")}
                  </h2>
                  <ul className="grid gap-3 sm:gap-5 lg:grid-cols-2">
                    {payload.recent.map((b) => (
                      <li key={b.id}>
                        <ArenaDuelBoard battle={b} size="rail" />
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
