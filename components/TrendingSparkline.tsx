"use client"

import type { LucideIcon } from "lucide-react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { HomeProductCard } from "@/lib/home-marketplace-data"

type Props = {
  items: HomeProductCard[]
  emptyLabel: string
  icon: LucideIcon
}

export function TrendingSparkline({ items, emptyLabel, icon: Icon }: Props) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="h-4 w-4" aria-hidden />
        {emptyLabel}
      </p>
    )
  }

  const max = Math.max(...items.map((p) => p.soldCount), 1)

  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <li key={p.listingId} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
          <span
            className="h-6 w-12 shrink-0 rounded bg-emerald-500/20"
            style={{ clipPath: `inset(${100 - (p.soldCount / max) * 100}% 0 0 0)` }}
            aria-hidden
          />
          <span className="shrink-0 text-zinc-500">
            {formatStoreCurrencyFromCents(p.priceCents)}
          </span>
        </li>
      ))}
    </ul>
  )
}
