import Link from "next/link"
import { ArrowRight } from "lucide-react"

import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"

type Props = {
  shops: PublicShopDirectoryEntry[]
}

/** Compact creator storefront row between hero and marketplace explorer. */
export function HomeFeaturedShopsStrip({ shops }: Props) {
  if (shops.length === 0) return null

  const featured = shops.slice(0, 6)

  return (
    <section aria-labelledby="featured-shops-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
            Créateurs
          </p>
          <h2
            id="featured-shops-heading"
            className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl"
          >
            Boutiques à la une
          </h2>
        </div>
        <Link
          href="/shops"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300"
        >
          Toutes les boutiques
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {featured.map((shop) => (
          <li key={shop.slug} className="w-[min(100%,16rem)] shrink-0 sm:w-56">
            <Link
              href={`/shops/${shop.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              {shop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.logoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                  {shop.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{shop.name}</p>
                <p className="text-xs text-zinc-500">{shop.nicheLabel}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
