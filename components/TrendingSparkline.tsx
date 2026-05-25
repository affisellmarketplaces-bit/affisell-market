"use client"

import { Sparkles, TrendingUp } from "lucide-react"
import { useTranslations } from "next-intl"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { HomeProductCard } from "@/lib/home-marketplace-cards"

type Props = {
  items: HomeProductCard[]
}

export function TrendingSparkline({ items }: Props) {
  const t = useTranslations("home.bento.trending")

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Sparkles className="h-4 w-4" aria-hidden />
        {t("empty")}
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
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
          <span className="shrink-0 text-zinc-500">
            {formatStoreCurrencyFromCents(p.priceCents)}
          </span>
        </li>
      ))}
    </ul>
  )
}
