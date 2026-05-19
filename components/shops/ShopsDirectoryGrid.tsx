"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"
import { cn } from "@/lib/utils"

const FILTER_LABELS = ["Toutes", "Fitness", "Tech", "Maison", "Beauté"] as const

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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((shop) => {
            const rating = shop.averageRating > 0 ? shop.averageRating.toFixed(1) : "—"
            return (
              <li
                key={shop.slug}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start gap-4">
                  {shop.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- creator CDN hosts
                    <img
                      src={shop.logoUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      {shop.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{shop.name}</p>
                    <p className="text-xs text-zinc-500">Univers {shop.nicheLabel}</p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      ★ Note {rating} · {shop.orderCount} commande
                      {shop.orderCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/shops/${shop.slug}`}
                  className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                >
                  Visiter
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
