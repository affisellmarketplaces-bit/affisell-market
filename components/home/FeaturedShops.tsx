"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

type Props = {
  shops: PublicShopDirectoryEntry[]
  emptyMessage?: string
}

export function FeaturedShops({ shops, emptyMessage }: Props) {
  const t = useTranslations("discovery")
  const tShops = useTranslations("shops")
  const empty = emptyMessage ?? tShops("featuredEmpty")

  if (shops.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shops.map((shop) => {
        const rating = shop.averageRating > 0 ? shop.averageRating.toFixed(1) : "—"
        const ordersLabel = tShops("ordersCount", { count: shop.orderCount })
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
                <p className="text-xs text-zinc-500">{t(`niches.${shop.nicheLabel}`)}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  ⭐ {rating} · {ordersLabel}
                </p>
              </div>
            </div>
            <Link
              href={`/shops/${shop.slug}`}
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              {tShops("visitStore")}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
