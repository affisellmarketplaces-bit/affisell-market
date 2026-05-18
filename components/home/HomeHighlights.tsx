"use client"

import { useState } from "react"

import { ProductCard } from "@/components/ProductCard"
import type { HomeHighlightsData, HomeProductCard } from "@/lib/home-marketplace-data"
import { homeProductToCardProps } from "@/lib/home-marketplace-data"
import { cn } from "@/lib/utils"

type TabId = "bestsellers" | "new" | "margin"

const TABS: { id: TabId; label: string }[] = [
  { id: "bestsellers", label: "Best Sellers 7j" },
  { id: "new", label: "New Arrivals" },
  { id: "margin", label: "High Margin" },
]

type Props = {
  data: HomeHighlightsData
}

function itemsForTab(tab: TabId, data: HomeHighlightsData): HomeProductCard[] {
  if (tab === "bestsellers") return data.bestSellers7d
  if (tab === "new") return data.newArrivals
  return data.highMargin
}

export function HomeHighlights({ data }: Props) {
  const [tab, setTab] = useState<TabId>("bestsellers")
  const items = itemsForTab(tab, data)

  return (
    <section aria-labelledby="highlights-heading" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Highlights</p>
          <h2 id="highlights-heading" className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            À la une sur Affisell
          </h2>
        </div>
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
          role="tablist"
          aria-label="Filtres produits"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm",
                tab === t.id
                  ? "bg-white text-violet-800 shadow-sm dark:bg-zinc-950 dark:text-violet-200"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          Nouveaux produits ajoutés chaque jour. Revenez demain.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <li key={`${tab}-${item.listingId}`}>
              <ProductCard product={homeProductToCardProps(item)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
