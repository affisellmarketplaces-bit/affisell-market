"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { trackAffisellEvent } from "@/lib/affisell-track-client"
import type { CarouselItemJson } from "@/lib/carousel-types"
import { addGuestCartItem } from "@/lib/guest-cart"
import { useLiveStats } from "@/lib/live-stats"
import { cn } from "@/lib/utils"
import { WishlistHeart } from "@/components/wishlist-heart"

type Props = {
  item: CarouselItemJson
  showTimer: boolean
  endAtMs: number
  recommendationQuery: string | null
}

export function AffisellCarouselCard({
  item,
  showTimer,
  endAtMs,
  recommendationQuery,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  const hoverStart = useRef<number | null>(null)
  const hoverSent = useRef(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewSent = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const live = useLiveStats(item.productId || item.listingId)

  const displayViews = Math.max(item.viewsToday, live.viewsToday)

  useEffect(() => {
    if (!showTimer) return
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [showTimer])

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.4 && !viewSent.current) {
            viewSent.current = true
            trackAffisellEvent("view", item.productId)
          }
        }
      },
      { threshold: [0, 0.4, 0.6] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [item.productId])

  const onEnter = useCallback(() => {
    hoverStart.current = Date.now()
    hoverTimerRef.current = setTimeout(() => {
      if (!hoverSent.current) {
        hoverSent.current = true
        trackAffisellEvent("hover", item.productId, { durationMs: 2000 })
      }
    }, 2000)
  }, [item.productId])

  const onLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (!hoverSent.current && hoverStart.current) {
      const d = Date.now() - hoverStart.current
      if (d >= 2000) {
        hoverSent.current = true
        trackAffisellEvent("hover", item.productId, { durationMs: d })
      }
    }
    hoverStart.current = null
  }, [item.productId])

  const leftMs = Math.max(0, endAtMs - now)
  const h = Math.floor(leftMs / 3_600_000)
  const m = Math.floor((leftMs % 3_600_000) / 60_000)

  const priceEur = (item.priceCents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  })
  const oldEur =
    item.compareAtCents != null && item.compareAtCents > item.priceCents
      ? (item.compareAtCents / 100).toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
        })
      : null

  const subline =
    item.stock <= 3
      ? `Plus que ${item.stock}`
      : item.deliveryMax <= 1
        ? "Livraison demain"
        : `Livraison ${item.deliveryMin}–${item.deliveryMax} j.`

  const tooltip = recommendationQuery
    ? `Pourquoi recommandé ? Vous avez cherché « ${recommendationQuery} »`
    : item.aiPick
      ? "Pourquoi recommandé ? Sélection Affisell AI (tendances et votre activité)."
      : "Pourquoi recommandé ? Basé sur vos consultations récentes."

  const badgeTrend = item.isTrending && item.viewsToday >= 5
  const badgePromo = item.promoPercent != null && item.promoPercent > 0

  return (
    <div
      ref={rootRef}
      className="group/card relative flex h-full w-[min(100%,180px)] max-w-[calc((100vw-4.5rem)/2.5)] shrink-0 snap-start flex-col sm:max-w-[180px] md:w-[180px]"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Link
        href={`/marketplace/${item.listingId}`}
        className="relative flex h-full flex-col overflow-visible rounded-md border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      >
        <WishlistHeart productId={item.productId} className="absolute right-1 top-1 z-30" />
        {showTimer ? (
          <div className="absolute right-0 top-0 z-20 max-w-[90%] rounded-bl-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
            Offre se termine dans {h}h{m.toString().padStart(2, "0")}
          </div>
        ) : null}

        {item.aiPick ? (
          <span className="absolute right-1 top-7 z-20 rounded bg-violet-600 px-1 py-0.5 text-[9px] font-bold uppercase text-white shadow-sm">
            IA
          </span>
        ) : null}

        <div className="relative mx-auto mt-0.5 h-[160px] w-[160px] max-w-full overflow-hidden rounded-sm sm:h-[170px] sm:w-[170px] md:h-[180px] md:w-[180px]">
          <div className="absolute left-1 top-1 z-10 flex max-w-[92%] flex-col gap-0.5">
            {badgeTrend ? (
              <span className="inline-flex animate-pulse rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                🔥 Tendance
              </span>
            ) : null}
            {badgePromo ? (
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                ⚡ -{item.promoPercent}%
              </span>
            ) : null}
            <span className="w-fit rounded bg-zinc-800/85 px-1.5 py-0.5 text-[10px] text-white">
              👁 {displayViews} vues
            </span>
          </div>

          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="h-full w-full object-contain transition-transform duration-300 group-hover/card:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
              Image
            </div>
          )}

          <div className="pointer-events-none absolute bottom-1 left-1 right-1 z-20 rounded border border-violet-100 bg-white/95 px-1.5 py-1 text-[9px] leading-tight text-zinc-700 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-200 group-hover/card:opacity-100">
            {tooltip}
          </div>

          <button
            type="button"
            className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/card:opacity-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              trackAffisellEvent("add_to_cart", item.productId)
              void fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: item.listingId, qty: 1 }),
              }).then((r) => {
                if (r.status === 401) {
                  addGuestCartItem({
                    productId: item.listingId,
                    qty: 1,
                    title: item.name,
                    price: item.priceCents / 100,
                    imageUrl: item.imageUrl || "/placeholder.png",
                  })
                }
              })
            }}
          >
            Ajouter
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-2 pt-1">
          <p className="line-clamp-2 text-xs leading-snug text-zinc-900">{item.name}</p>
          <div className="mt-auto pt-1">
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="text-lg font-bold text-[#c41e3a]">{priceEur}</span>
              {oldEur ? (
                <span className="text-xs text-zinc-400 line-through">{oldEur}</span>
              ) : null}
            </div>
            <p
              className={cn(
                "text-[11px] font-medium",
                item.stock <= 3 ? "text-orange-600" : "text-emerald-600"
              )}
            >
              {subline}
            </p>
            <div className="mt-1 flex items-center gap-1 rounded bg-zinc-50 px-1 py-0.5 text-[10px] text-zinc-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {live.viewersNow} personnes regardent
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
