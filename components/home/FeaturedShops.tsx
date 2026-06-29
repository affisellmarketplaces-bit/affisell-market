"use client"

import { useTranslations } from "next-intl"

import { ShopDirectoryCard } from "@/components/shops/shop-directory-card"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

type Props = {
  shops: PublicShopDirectoryEntry[]
  emptyMessage?: string
}

export function FeaturedShops({ shops, emptyMessage }: Props) {
  const tShops = useTranslations("shops")
  const empty = emptyMessage ?? tShops("featuredEmpty")

  if (shops.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {shops.map((shop) => (
        <li key={shop.slug} className="h-full">
          <ShopDirectoryCard shop={shop} />
        </li>
      ))}
    </ul>
  )
}
