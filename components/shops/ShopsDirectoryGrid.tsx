"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"

import { FeaturedShops } from "@/components/home/FeaturedShops"
import type { NicheKey } from "@/lib/shop-storefront-data"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"
import { cn } from "@/lib/utils"

type ShopFilter = "all" | NicheKey

const SHOP_FILTER_KEYS: readonly ShopFilter[] = ["all", "fitness", "tech", "beauty", "home"] as const

export function ShopsDirectoryGrid({ shops }: { shops: PublicShopDirectoryEntry[] }) {
  const t = useTranslations("shops")
  const tDiscovery = useTranslations("discovery")
  const [filter, setFilter] = useState<ShopFilter>("all")

  const visible = useMemo(() => {
    if (filter === "all") return shops
    return shops.filter((s) => s.nicheLabel === filter)
  }, [shops, filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("filterAria")}>
        {SHOP_FILTER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              filter === key
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            )}
          >
            {key === "all" ? t("filterAll") : tDiscovery(`niches.${key}`)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("emptyCategory")}</p>
      ) : (
        <FeaturedShops shops={visible} />
      )}
    </div>
  )
}
