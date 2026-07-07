import Image from "next/image"
import Link from "next/link"

import type { BrowseCategoryListingItem } from "@/lib/seo-category-pages"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

type Props = {
  items: BrowseCategoryListingItem[]
}

export function CategoryBrowseGrid({ items }: Props) {
  if (items.length === 0) return null

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.listingId}>
          <Link
            href={item.href}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400">—</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
              {item.storeName ? (
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{item.storeName}</p>
              ) : null}
              <p className="mt-auto text-sm font-semibold text-violet-700 dark:text-violet-300">
                {formatStoreCurrencyFromCents(item.priceCents)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
