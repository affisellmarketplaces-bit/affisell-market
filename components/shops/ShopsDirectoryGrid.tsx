"use client"

import { useMemo, useState } from "react"

import { FeaturedShops } from "@/components/home/FeaturedShops"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"
import { cn } from "@/lib/utils"

const FILTER_LABELS = ["Toutes", "Fitness", "Tech", "Beauté", "Maison"] as const

export function ShopsDirectoryGrid({ shops }: { shops: PublicShopDirectoryEntry[] }) {
  const [filter, setFilter] = useState<(typeof FILTER_LABELS)[number]>("Toutes")

  const visible = useMemo(() => {
    if (filter === "Toutes") return shops
    return shops.filter((s) => s.nicheLabel === filter)
  }, [shops, filter])

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filtrer par univers"
      >
        {FILTER_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={filter === label}
            onClick={() => setFilter(label)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              filter === label
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            )}
          >
            {label === "Toutes" ? "[Toutes]" : `[${label}]`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune boutique dans cette catégorie pour le moment.</p>
      ) : (
        <FeaturedShops shops={visible} />
      )}
    </div>
  )
}
