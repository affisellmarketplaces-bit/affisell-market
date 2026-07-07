"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Store } from "lucide-react"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

import {
  buyerServiceTileClass,
  buyerServiceTileItemClass,
} from "@/components/home/home-buyer-glass-tile"
import { FastLink } from "@/components/navigation/fast-link"
import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import type { HomeFeaturedShopDeckCard } from "@/lib/home-featured-shops-deck-shared"
import { cn } from "@/lib/utils"

const VISIBLE = 3
const CYCLE_MS = 3600

const FAN = [
  { rotate: -14, x: -18, y: 10, scale: 0.85, opacity: 0.74 },
  { rotate: -1, x: 0, y: 4, scale: 0.94, opacity: 0.9 },
  { rotate: 12, x: 18, y: -4, scale: 1, opacity: 1 },
] as const

type Props = {
  cards: HomeFeaturedShopDeckCard[]
  label: string
  hint: string
  badgeLabel: string
  fallbackHref?: string
}

function ShopPlayingCard({
  card,
  depth,
  total,
}: {
  card: HomeFeaturedShopDeckCard
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
        isFront && "shadow-[0_16px_36px_rgba(124,58,237,0.4)]"
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
          "relative flex h-full w-full flex-col overflow-hidden rounded-[0.65rem] border bg-gradient-to-br from-white/30 via-violet-950/15 to-indigo-950/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-sm",
          isFront ? "border-white/55 ring-1 ring-white/30" : "border-white/35"
        )}
        style={
          isFront
            ? {
                boxShadow: `0 16px 36px ${card.accent}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
              }
            : undefined
        }
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_35%,rgba(255,255,255,0.18)_50%,transparent_65%)] bg-[length:220%_100%] animate-[gradient-shift_5s_ease_infinite]"
          aria-hidden
        />
        <div className="relative flex flex-1 items-center justify-center p-1.5 pt-2">
          {card.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- creator CDN hosts vary
            <img
              src={card.logoUrl}
              alt=""
              className="h-9 w-9 rounded-full border border-white/40 object-cover shadow-sm sm:h-10 sm:w-10"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-gradient-to-br from-violet-500/50 to-indigo-800/80 sm:h-10 sm:w-10"
              style={{ background: `linear-gradient(135deg, ${card.accent}99, #312e81)` }}
            >
              <Store className="h-4 w-4 text-white/90" aria-hidden />
            </span>
          )}
        </div>
        <div className="relative bg-gradient-to-t from-black/80 via-black/50 to-transparent px-1 pb-1 pt-2">
          <p className="truncate text-center text-[7px] font-bold leading-tight text-white sm:text-[8px]">
            {card.name}
          </p>
          {card.metaLabel ? (
            <p className="truncate text-center text-[6px] font-medium text-violet-100/85 sm:text-[7px]">
              {card.metaLabel}
            </p>
          ) : card.priceLabel ? (
            <p className="truncate text-center text-[6px] font-medium text-violet-100/85 sm:text-[7px]">
              {card.priceLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function HomeBuyerFeaturedShopsDeck({
  cards,
  label,
  hint,
  badgeLabel,
  fallbackHref = PUBLIC_SHOPS_PATH,
}: Props) {
  const reduceMotion = usePrefersReducedMotion()
  const accent = BUYER_TILE_ACCENTS.stores.glow
  const iconAccent = BUYER_TILE_ACCENTS.stores.icon
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
  const href = front?.href ?? fallbackHref

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
                "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl border-2 border-white/30 bg-gradient-to-br px-1.5 shadow-inner ring-1 ring-white/20 sm:h-9 sm:min-w-9",
                iconAccent
              )}
              aria-hidden
            >
              <span className="text-[10px] font-extrabold leading-none tracking-tight text-white sm:text-[11px]">
                {badgeLabel}
              </span>
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
            <span className="text-[10px] font-extrabold leading-none tracking-tight text-white sm:text-[11px]">
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
            <ShopPlayingCard key={card.slug} card={card} depth={depth} total={stack.length} />
          ))}
        </div>

        <span className="relative min-w-0 flex-1 lg:mt-2 lg:block">
          <span className="block text-xs font-bold leading-snug text-white sm:text-sm">{label}</span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-violet-100/85 sm:text-[11px] lg:line-clamp-none">
            {hint}
          </span>
          {front ? (
            <span className="mt-1 hidden truncate text-[10px] font-medium text-violet-100/90 lg:block">
              {front.name}
              {front.priceLabel ? ` · ${front.priceLabel}` : null}
            </span>
          ) : null}
        </span>
      </FastLink>
    </li>
  )
}
