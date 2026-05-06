"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AffisellCarouselBundleCard } from "@/components/affisell-carousel-bundle-card"
import { AffisellCarouselCard } from "@/components/affisell-carousel-card"
import type { CarouselItemJson } from "@/lib/carousel-types"
import { cn } from "@/lib/utils"

type Slot =
  | { kind: "product"; item: CarouselItemJson; key: string }
  | { kind: "bundle"; a: CarouselItemJson; b: CarouselItemJson; key: string }

function buildSlots(items: CarouselItemJson[]): Slot[] {
  if (items.length < 3) {
    return items.map((item, i) => ({
      kind: "product" as const,
      item,
      key: `${item.listingId}-${i}`,
    }))
  }
  const a = items[0]!
  const b = items[1]!
  return [
    { kind: "product", item: a, key: a.listingId },
    { kind: "product", item: b, key: b.listingId },
    { kind: "bundle", a, b, key: `bundle-${a.listingId}-${b.listingId}` },
    ...items.slice(2).map((item, i) => ({
      kind: "product" as const,
      item,
      key: `${item.listingId}-${i + 2}`,
    })),
  ]
}

/** Stable “random” slot among first product slots (excludes bundle). */
function timerSlotIndex(slots: Slot[]): number {
  const prodIdx = slots
    .map((s, i) => (s.kind === "product" ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, 5)
  if (prodIdx.length === 0) return -1
  let h = 0
  for (const i of prodIdx) {
    const s = slots[i]
    if (s?.kind !== "product") continue
    const id = s.item.listingId
    for (let j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) | 0
  }
  return prodIdx[Math.abs(h) % prodIdx.length]!
}

type Props = {
  title: string
  voirPlusHref: string
  items: CarouselItemJson[]
  recommendationQuery: string | null
}

export function AffisellCarousel({
  title,
  voirPlusHref,
  items,
  recommendationQuery,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [dotIndex, setDotIndex] = useState(0)
  const [endAtMs] = useState(() => Date.now() + (2 * 60 + 14) * 60 * 1000)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const slots = useMemo(() => buildSlots(items), [items])

  const timerIdx = useMemo(() => timerSlotIndex(slots), [slots])

  const scrollStep = useCallback(() => {
    const el = scrollRef.current
    if (!el || slots.length === 0) return
    const card = el.querySelector<HTMLElement>("[data-carousel-card]")
    const w = card?.offsetWidth ?? 180
    const gap = 12
    const maxScroll = el.scrollWidth - el.clientWidth
    if (el.scrollLeft >= maxScroll - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" })
    } else {
      el.scrollBy({ left: w + gap, behavior: "smooth" })
    }
  }, [slots.length])

  useEffect(() => {
    if (paused || slots.length <= 1) return
    const t = setInterval(scrollStep, 8000)
    return () => clearInterval(t)
  }, [paused, scrollStep, slots.length])

  const updateScrollUi = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanPrev(el.scrollLeft > 8)
    setCanNext(el.scrollLeft < maxScroll - 8)
    const card = el.querySelector<HTMLElement>("[data-carousel-card]")
    const step = (card?.offsetWidth ?? 172) + 12
    setDotIndex(Math.max(0, Math.round(el.scrollLeft / step)))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollUi()
    el.addEventListener("scroll", updateScrollUi, { passive: true })
    const ro = new ResizeObserver(updateScrollUi)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollUi)
      ro.disconnect()
    }
  }, [updateScrollUi, slots])

  const showArrows = slots.length > 1

  const go = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>("[data-carousel-card]")
    const w = card?.offsetWidth ?? 180
    el.scrollBy({ left: dir * (w + 12), behavior: "smooth" })
  }

  return (
    <section className="w-full">
      <div
        className="group/carousel relative flex h-[320px] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="mb-3 flex shrink-0 items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">{title}</h2>
          <Link
            href={voirPlusHref}
            className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            See more
          </Link>
        </div>
        <div className="relative min-h-0 flex-1">
          {showArrows ? (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => go(-1)}
                disabled={!canPrev}
                className={cn(
                  "absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-md transition-opacity md:flex",
                  canPrev ? "opacity-0 group-hover/carousel:opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => go(1)}
                disabled={!canNext}
                className={cn(
                  "absolute right-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-md transition-opacity md:flex",
                  canNext ? "opacity-0 group-hover/carousel:opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                ›
              </button>
            </>
          ) : null}

          <div
            ref={scrollRef}
            className="flex h-full min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] md:snap-none [&::-webkit-scrollbar]:hidden"
          >
          {slots.map((slot, idx) => {
            if (slot.kind === "bundle") {
              return (
                <div key={slot.key} data-carousel-card className="shrink-0">
                  <AffisellCarouselBundleCard a={slot.a} b={slot.b} />
                </div>
              )
            }
            const showTimer = idx === timerIdx
            return (
              <div key={slot.key} data-carousel-card className="shrink-0">
                <AffisellCarouselCard
                  item={slot.item}
                  showTimer={showTimer}
                  endAtMs={endAtMs}
                  recommendationQuery={recommendationQuery}
                />
              </div>
            )
          })}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 md:hidden">
          {slots.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === dotIndex ? "w-4 bg-violet-600" : "w-1.5 bg-zinc-300"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
