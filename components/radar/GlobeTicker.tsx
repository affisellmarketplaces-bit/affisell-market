"use client"

import type { LiveEvent } from "@/lib/radar/live-types"

type Props = {
  events: LiveEvent[]
}

function minutesAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(1, Math.min(59, Math.floor(ms / 60_000) || 1))
}

/**
 * Bottom marquee of live winner signals.
 */
export function GlobeTicker({ events }: Props) {
  const items = events.slice(0, 10)
  if (items.length === 0) return null

  const row = items.map((e) => (
    <span key={e.id} className="inline-flex shrink-0 items-center gap-2 text-xs text-white/70">
      <span aria-hidden>🔥</span>
      {e.product.title.slice(0, 30)}
      {" — "}
      {e.location.city}
      {" — il y a "}
      {minutesAgo(e.timestamp)}
      min
    </span>
  ))

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex h-10 items-center overflow-hidden border-t border-white/10 bg-black/80 backdrop-blur"
      data-testid="radar-globe-ticker"
    >
      <div
        className="flex w-max gap-8 whitespace-nowrap px-4 will-change-transform"
        style={{ animation: "affisell-marquee-scroll 36s linear infinite" }}
      >
        {row}
        {row}
      </div>
    </div>
  )
}
