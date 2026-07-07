"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, TrendingUp } from "lucide-react"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

import {
  buyerServiceTileClass,
  buyerServiceTileItemClass,
} from "@/components/home/home-buyer-glass-tile"
import { FastLink } from "@/components/navigation/fast-link"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import type { HomeBestSellerDeckCard } from "@/lib/home-best-seller-deck-shared"
import { cn } from "@/lib/utils"

const VISIBLE = 3
const CYCLE_MS = 3400

const FAN = [
  { rotate: -16, x: -20, y: 8, scale: 0.84, opacity: 0.72 },
  { rotate: -2, x: 0, y: 2, scale: 0.93, opacity: 0.88 },
  { rotate: 14, x: 20, y: -6, scale: 1, opacity: 1 },
] as const

type Props = {
  cards: HomeBestSellerDeckCard[]
  label: string
  hint: string
  badgeLabel: string
  fallbackHref: string
}

function PlayingCard({
  card,
  depth,
  total,
}: {
  card: HomeBestSellerDeckCard
  depth: number
  total: number
}) {
  const pose = FAN[Math.min(depth, FAN.length - 1)]
  const isFront = depth === total - 1

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-0 left-1/2 h-[4.35rem] w-[3.05rem] origin-bottom sm:h-[4.75rem] sm:w-[3.25rem]",
        "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)] motion-reduce:transition-none",
        isFront && "shadow-[0_16px_36px_rgba(251,191,36,0.35)]"
      )}
      style={{
        transform: `translateX(calc(-50% + ${pose.x}px)) translateY(${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scale})`,
        opacity: pose.opacity,
        zIndex: depth + 1,
      }}
      aria-hidden
    >
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-[0.65rem] border bg-gradient-to-br from-white/25 via-violet-950/20 to-indigo-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-sm",
          isFront
            ? "border-amber-200/70 ring-1 ring-amber-300/40"
            : "border-white/35"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_35%,rgba(255,255,255,0.22)_50%,transparent_65%)] bg-[length:220%_100%] animate-[gradient-shift_4s_ease_infinite]"
          aria-hidden
        />
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny deck thumbnails, mixed CDN hosts
          <img
            src={card.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-violet-500/40 to-indigo-900/80"
            aria-hidden
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-1 pb-1 pt-4">
          <p className="truncate text-[7px] font-bold leading-tight text-white sm:text-[8px]">
            {card.priceLabel}
          </p>
          <p className="truncate text-[6px] font-medium text-violet-100/80 sm:text-[7px]">
            {card.soldLabel}
          </p>
        </div>
        <span className="absolute left-0.5 top-0.5 rounded-md border border-white/25 bg-gradient-to-br from-amber-400 to-fuchsia-600 px-1 py-0.5 text-[7px] font-black leading-none text-white shadow-sm">
          #{card.rank}
        </span>
      </div>
    </div>
  )
}

export function HomeBuyerBestSellersDeck({
  cards,
  label,
  hint,
  badgeLabel,
  fallbackHref,
}: Props) {
  const reduceMotion = usePrefersReducedMotion()
  const accent = BUYER_TILE_ACCENTS.bestSellers.glow
  const iconAccent = BUYER_TILE_ACCENTS.bestSellers.icon
  const [cursor, setCursor] = useState(0)
  const [paused, setPaused] = useState(false)

  const count = Math.min(VISIBLE, cards.length)

  useEffect(() => {
    if (reduceMotion || cards.length <= 1 || paused) return
    const id = window.setInterval(() => {
      setCursor((value) => (value + 1) % cards.length)
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [cards.length, paused, reduceMotion])

  const stack = useMemo(() => {
    if (cards.length === 0) return []
    return Array.from({ length: count }, (_, depth) => {
      const index = (cursor - depth + cards.length) % cards.length
      return cards[index]!
    }).reverse()
  }, [cards, count, cursor])

  const front = stack[stack.length - 1]
  const href = front ? `/marketplace/${front.listingId}` : fallbackHref

  if (cards.length === 0) {
    return (
      <li className={buyerServiceTileItemClass}>
        <FastLink href={fallbackHref} className={buyerServiceTileClass}>
          <span
            className={cn(
              "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition group-hover:opacity-60",
              accent
            )}
            aria-hidden
          />
          <span className="relative flex shrink-0 items-center justify-between gap-2 max-lg:contents lg:w-full lg:items-start">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner sm:h-9 sm:w-9",
                iconAccent
              )}
            >
              <TrendingUp className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" aria-hidden />
            </span>
            <ArrowUpRight
              className="hidden h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white lg:block"
              aria-hidden
            />
          </span>
          <span className="relative min-w-0 flex-1 max-lg:mt-0 lg:mt-3 lg:block">
            <span className="block text-xs font-bold leading-snug text-white sm:text-sm">{label}</span>
            <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-violet-100/85 sm:text-[11px] lg:line-clamp-none">
              {hint}
            </span>
          </span>
        </FastLink>
      </li>
    )
  }

  return (
    <li className={buyerServiceTileItemClass}>
      <FastLink
        href={href}
        className={cn(
          buyerServiceTileClass,
          "lg:min-h-[7.25rem] lg:pb-3.5",
          "max-lg:min-h-[5rem]"
        )}
        aria-label={front ? `${label}: ${front.name}` : label}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <span
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-45 blur-2xl transition group-hover:opacity-65",
            accent
          )}
          aria-hidden
        />
        <span className="relative flex shrink-0 items-center justify-between gap-2 max-lg:contents lg:w-full lg:items-start">
          <span
            className={cn(
              "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl border-2 border-white/30 bg-gradient-to-br px-1.5 shadow-inner ring-1 ring-white/20 sm:h-9 sm:min-w-9",
              iconAccent
            )}
            aria-hidden
          >
            <span className="text-[9px] font-extrabold leading-none tracking-tight text-white sm:text-[10px]">
              {badgeLabel}
            </span>
          </span>
          <ArrowUpRight
            className="hidden h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white lg:block"
            aria-hidden
          />
        </span>

        <div
          className="relative mx-auto h-[4.2rem] w-[6.25rem] shrink-0 [perspective:900px] max-lg:order-3 max-lg:scale-[0.78] lg:mt-1 lg:h-[5.1rem] lg:w-full lg:max-w-[9.5rem]"
          aria-hidden
        >
          {stack.map((card, depth) => (
            <PlayingCard key={card.listingId} card={card} depth={depth} total={stack.length} />
          ))}
        </div>

        <span className="relative min-w-0 flex-1 lg:mt-2 lg:block">
          <span className="block text-xs font-bold leading-snug text-white sm:text-sm">{label}</span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-violet-100/85 sm:text-[11px] lg:line-clamp-none">
            {hint}
          </span>
          {front ? (
            <span className="mt-1 hidden truncate text-[10px] font-medium text-amber-100/90 lg:block">
              {front.name}
            </span>
          ) : null}
        </span>
      </FastLink>
    </li>
  )
}
