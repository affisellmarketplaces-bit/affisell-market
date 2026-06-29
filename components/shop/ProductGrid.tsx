"use client"

import { useTranslations } from "next-intl"

import type { ProductCardDisplayMode } from "@/components/product/ProductCard"
import { StorefrontProductCard } from "@/components/storefront/product-card"
import type { ShopProductCard } from "@/lib/shop-storefront-shared"
import {
  storefrontGridClass,
  type StorefrontGridDensity,
} from "@/lib/storefront-theme-shared"

type Props = {
  storeSlug: string
  products: ShopProductCard[]
  /** Set by the server — never derive business fields on the client for buyer pages. */
  mode: ProductCardDisplayMode
  gridDensity?: StorefrontGridDensity
  dedicatedHost?: boolean
  activeCategoryLabel?: string | null
}

export function ProductGrid({
  storeSlug,
  products,
  mode,
  gridDensity,
  dedicatedHost = false,
  activeCategoryLabel,
}: Props) {
  const t = useTranslations("boutique")
  const tChrome = useTranslations("storefront.buyerChrome")

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        {t("noProducts")}
      </p>
    )
  }

  return (
    <>
      {dedicatedHost && activeCategoryLabel ? (
        <p className="mb-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {tChrome("showingCategory", { category: activeCategoryLabel, count: products.length })}
        </p>
      ) : null}
      <ul className={storefrontGridClass(gridDensity)}>
        {products.map((item) => (
          <li key={item.listingId}>
            <StorefrontProductCard
              product={item}
              storeSlug={storeSlug}
              mode={mode}
              dedicatedHost={dedicatedHost}
            />
          </li>
        ))}
      </ul>
    </>
  )
}
