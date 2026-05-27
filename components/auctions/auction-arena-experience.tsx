"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  Gavel,
  Loader2,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { AuctionCountdown } from "@/components/auctions/auction-countdown"
import { affisellBrand } from "@/lib/affisell-brand"
import type { AuctionArenaPayload, AuctionLotPublic } from "@/lib/auction-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  initial: AuctionArenaPayload
}

const POLL_MS = 4_000

export function AuctionArenaExperience({ initial }: Props) {
  const t = useTranslations("auctions")
  const router = useRouter()
  const { data: session } = useSession()
  const loggedIn = Boolean(session?.user?.id)

  const [payload, setPayload] = useState(initial)
  const [focusId, setFocusId] = useState(initial.lots[0]?.id ?? "")
  const [bidBusy, setBidBusy] = useState(false)
  const [bidPulse, setBidPulse] = useState(false)

  const focusLot = useMemo(
    () => payload.lots.find((l) => l.id === focusId) ?? payload.lots[0] ?? null,
    [payload.lots, focusId]
  )

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auctions", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as AuctionArenaPayload
      setPayload(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  async function placeBid(lot: AuctionLotPublic, amountCents?: number) {
    const bid = amountCents ?? lot.minNextBidCents
    if (!loggedIn) {
      const returnTo = `/auctions?lot=${encodeURIComponent(lot.id)}`
      router.push(`/signup/customer?callbackUrl=${encodeURIComponent(returnTo)}`)
      return
    }

    setBidBusy(true)
    try {
      const res = await fetch(`/api/auctions/${encodeURIComponent(lot.id)}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amountCents: bid }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        loginRequired?: boolean
      }
      if (res.status === 401 || data.loginRequired) {
        router.push(
          `/signup/customer?callbackUrl=${encodeURIComponent(`/auctions?lot=${lot.id}`)}`
        )
        return
      }
      if (!res.ok) {
        toast.error(data.error ?? t("bidFailed"))
        return
      }
      setBidPulse(true)
      window.setTimeout(() => setBidPulse(false), 600)
      toast.success(t("bidPlaced"))
      await refresh()
    } finally {
      setBidBusy(false)
    }
  }

  const tickerItems = useMemo(() => {
    const fromBids = payload.recentBids.map(
      (b) => `${b.bidderLabel} · ${formatStoreCurrencyFromCents(b.amountCents)}`
    )
    if (fromBids.length === 0) return [t("tickerEmpty")]
    return [...fromBids, ...fromBids]
  }, [payload.recentBids, t])

  return (
    <div className="affisell-auction-arena" data-testid="auction-arena">
      <div className="affisell-auction-grid pointer-events-none absolute inset-0 opacity-80" aria-hidden />

      <header
        className={cn(
          affisellBrand.epoxySurface,
          "relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
        )}
      >
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">
            {t("eyebrow")}
          </p>
          <h1 className={cn(affisellBrand.brandWordmark, "text-lg sm:text-xl")}>{t("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 ring-1 ring-rose-400/40">
            <Radio className="size-3 animate-pulse" />
            {t("live")}
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pb-10">
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40 py-2 backdrop-blur-md">
          <div className="affisell-auction-ticker flex whitespace-nowrap text-xs font-medium text-white/70">
            {tickerItems.map((line, i) => (
              <span key={`${line}-${i}`} className="mx-6 inline-flex items-center gap-2">
                <Gavel className="size-3 text-violet-300" aria-hidden />
                {line}
              </span>
            ))}
          </div>
        </div>

        {focusLot ? (
          <motion.article
            layout
            className={cn(
              affisellBrand.epoxySurface,
              "affisell-auction-lot-glow relative overflow-hidden rounded-[1.75rem] p-4 sm:p-6",
              bidPulse && "ring-2 ring-cyan-400/60"
            )}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-violet-600/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-cyan-500/20 blur-3xl" />

            <div className="relative grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-900/80">
                {bidPulse ? (
                  <span
                    className="affisell-auction-pulse-ring pointer-events-none absolute inset-4 rounded-2xl ring-2 ring-cyan-400/50"
                    aria-hidden
                  />
                ) : null}
                <Image
                  src={focusLot.imageUrl}
                  alt=""
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 400px"
                  unoptimized={
                    focusLot.imageUrl.startsWith("http") || focusLot.imageUrl.startsWith("data:")
                  }
                />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {focusLot.status === "ENDING_SOON" ? (
                    <span className="rounded-full bg-rose-500/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                      {t("endingSoon")}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-violet-600/90 px-2.5 py-1 text-[10px] font-bold tabular-nums text-white">
                    {t("heat", { score: focusLot.heatScore })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div>
                  {focusLot.storeName ? (
                    <p className="text-xs font-medium uppercase tracking-wider text-cyan-300/80">
                      {focusLot.storeName}
                    </p>
                  ) : null}
                  <h2 className="mt-1 line-clamp-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
                    {focusLot.title}
                  </h2>
                  <p className="mt-3 text-sm text-white/55">{t("subtitle")}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className={cn(affisellBrand.epoxyChip, "rounded-xl p-3")}>
                    <p className="text-[10px] uppercase tracking-wider text-white/50">{t("currentBid")}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">
                      {formatStoreCurrencyFromCents(
                        focusLot.currentBidCents > 0
                          ? focusLot.currentBidCents
                          : focusLot.startPriceCents
                      )}
                    </p>
                  </div>
                  <div className={cn(affisellBrand.epoxyChip, "rounded-xl p-3")}>
                    <p className="text-[10px] uppercase tracking-wider text-white/50">{t("bids")}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">{focusLot.bidCount}</p>
                  </div>
                  <div
                    className={cn(
                      affisellBrand.epoxyChip,
                      "col-span-2 rounded-xl p-3 sm:col-span-1",
                      focusLot.status === "ENDING_SOON" && "ring-1 ring-rose-400/50"
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-white/50">{t("endsIn")}</p>
                    <AuctionCountdown
                      endsAt={focusLot.endsAt}
                      className="mt-1 text-cyan-200"
                      urgentClassName="mt-1 text-rose-300"
                    />
                  </div>
                </div>

                {focusLot.leaderLabel ? (
                  <p className="text-sm text-white/60">
                    {t("leader")}{" "}
                    <span className="font-semibold text-violet-200">{focusLot.leaderLabel}</span>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={bidBusy || focusLot.status === "ENDED"}
                    onClick={() => void placeBid(focusLot)}
                    className={cn(
                      affisellBrand.epoxyCta,
                      "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 disabled:opacity-50"
                    )}
                  >
                    {bidBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Zap className="size-4" />
                    )}
                    {t("bidNow")}{" "}
                    {formatStoreCurrencyFromCents(focusLot.minNextBidCents)}
                  </button>
                  <button
                    type="button"
                    disabled={bidBusy || focusLot.status === "ENDED"}
                    onClick={() =>
                      void placeBid(
                        focusLot,
                        focusLot.minNextBidCents +
                          Math.max(100, Math.ceil(focusLot.minNextBidCents * 0.1))
                      )
                    }
                    className={cn(
                      affisellBrand.epoxyActionBtn,
                      "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50"
                    )}
                  >
                    <Sparkles className="size-4 text-amber-300" />
                    {t("powerBid")}
                  </button>
                  <Link
                    href={focusLot.href}
                    className={cn(
                      affisellBrand.epoxyChip,
                      "inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-white/90"
                    )}
                  >
                    {t("viewProduct")}
                  </Link>
                </div>
              </div>
            </div>
          </motion.article>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-white/60">
            {t("empty")}
          </p>
        )}

        {payload.lots.length > 1 ? (
          <section className="mt-8">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/50">
              {t("moreLots")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {payload.lots
                .filter((l) => l.id !== focusLot?.id)
                .map((lot) => (
                  <motion.button
                    key={lot.id}
                    type="button"
                    layout
                    onClick={() => setFocusId(lot.id)}
                    className={cn(
                      affisellBrand.epoxySurface,
                      "group flex gap-3 rounded-2xl p-3 text-left transition hover:ring-1 hover:ring-violet-400/40",
                      focusId === lot.id && "ring-2 ring-cyan-400/50"
                    )}
                  >
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                      <Image
                        src={lot.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized={lot.imageUrl.startsWith("http")}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-white">{lot.title}</p>
                      <p className="mt-1 text-xs font-bold tabular-nums text-cyan-200">
                        {formatStoreCurrencyFromCents(
                          lot.currentBidCents > 0 ? lot.currentBidCents : lot.startPriceCents
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/45">
                        {lot.bidCount} {t("bids").toLowerCase()} · {t("heat", { score: lot.heatScore })}
                      </p>
                    </div>
                  </motion.button>
                ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
