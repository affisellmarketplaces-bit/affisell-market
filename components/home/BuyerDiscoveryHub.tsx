"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowRight, Search, Sparkles, Store } from "lucide-react"

import { ProductCard } from "@/components/product/ProductCard"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import type { BuyerCategoryChip, BuyerListingCard } from "@/lib/buyer-discovery-data"
import { buyerListingToCardProps } from "@/lib/buyer-discovery-data"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"
import { NICHE_FILTER_KEYS, type NicheFilterKey } from "@/lib/niche-label"
import { cn } from "@/lib/utils"

type Props = {
  shops: PublicShopDirectoryEntry[]
  products: BuyerListingCard[]
  categories: BuyerCategoryChip[]
}

export function BuyerDiscoveryHub({ shops, products, categories }: Props) {
  const t = useTranslations("discovery")
  const [shopSlug, setShopSlug] = useState<string | null>(null)
  const [niche, setNiche] = useState<NicheFilterKey>("all")
  const [category, setCategory] = useState<string | null>(null)
  const [q, setQ] = useState("")

  const filteredProducts = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return products.filter((p) => {
      if (shopSlug && p.storeSlug !== shopSlug) return false
      if (niche !== "all" && p.nicheLabel !== niche) return false
      if (category && !p.categories.some((c) => c === category)) return false
      if (!needle) return true
      if (p.name.toLowerCase().includes(needle)) return true
      if (p.storeName.toLowerCase().includes(needle)) return true
      return p.categories.some((c) => c.toLowerCase().includes(needle))
    })
  }, [products, shopSlug, niche, category, q])

  const filteredShops = useMemo(() => {
    if (niche === "all") return shops
    return shops.filter((s) => s.nicheLabel === niche)
  }, [shops, niche])

  function selectShop(slug: string | null) {
    setShopSlug(slug)
    if (slug) {
      const shop = shops.find((s) => s.slug === slug)
      if (shop) setNiche(shop.nicheLabel)
    }
  }

  return (
    <section className="space-y-8" aria-labelledby="discovery-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
            {t("eyebrow")}
          </p>
          <h2
            id="discovery-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl"
          >
            {t("title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        <Link
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {t("fullMarketplace")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="rounded-3xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/80 sm:p-6">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <label htmlFor="home-discovery-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <input
            id="home-discovery-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 py-2 pl-11 pr-4 text-sm outline-none ring-violet-500/20 transition focus:border-violet-400 focus:bg-white focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900/80 dark:focus:border-violet-600"
          />
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("creators")}</p>
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => selectShop(null)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-2 rounded-2xl border px-3 py-2 transition",
                shopSlug === null
                  ? "border-violet-500 bg-violet-50 shadow-md shadow-violet-500/15 dark:border-violet-500 dark:bg-violet-950/50"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <span className="max-w-[4.5rem] truncate text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
                {t("allCreators")}
              </span>
            </button>
            {filteredShops.map((shop) => (
              <button
                key={shop.slug}
                type="button"
                onClick={() => selectShop(shop.slug)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-2 rounded-2xl border px-3 py-2 transition",
                  shopSlug === shop.slug
                    ? "border-violet-500 bg-violet-50 shadow-md shadow-violet-500/15 dark:border-violet-500 dark:bg-violet-950/50"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                )}
              >
                {shop.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.logoUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                    {shop.name.slice(0, 1)}
                  </span>
                )}
                <span className="max-w-[5.5rem] truncate text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
                  {shop.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:w-auto sm:py-2">
            {t("nichesLabel")}
          </span>
          {NICHE_FILTER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setNiche(key)
                setShopSlug(null)
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                niche === key
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              )}
            >
              {t(`niches.${key}`)}
            </button>
          ))}
        </div>

        {categories.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="w-full text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:w-auto sm:py-2">
              {t("categoriesLabel")}
            </span>
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                category === null
                  ? "bg-violet-600 text-white shadow-sm"
                  : "border border-violet-200/80 bg-violet-50/80 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
              )}
            >
              {t("allCatalog")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.name)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                  category === cat.name
                    ? "bg-violet-600 text-white shadow-sm"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:border-violet-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                )}
              >
                {cat.name}
                <span className="ml-1 opacity-70">({cat.count})</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
            {t("productCount", { count: filteredProducts.length })}
          </strong>
          {shopSlug ? (
            <>
              {t("atStore")}
              <span className="text-violet-700 dark:text-violet-300">
                {shops.find((s) => s.slug === shopSlug)?.name ?? t("thisCreator")}
              </span>
            </>
          ) : null}
        </p>
        {shopSlug ? (
          <Link
            href={`/shops/${encodeURIComponent(shopSlug)}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300"
          >
            <Store className="h-4 w-4" aria-hidden />
            {t("viewStore")}
          </Link>
        ) : null}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t("emptyBody")}</p>
          <Link
            href={PUBLIC_MARKETPLACE_BROWSE_PATH}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-violet-700"
          >
            {t("viewAllProducts")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((item) => (
            <li key={item.listingId} className="flex h-full">
              <ProductCard product={buyerListingToCardProps(item)} mode="customer" />
            </li>
          ))}
        </ul>
      )}

      {shops.length > 0 ? (
        <div className="rounded-3xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 via-white to-violet-50/30 p-6 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/20 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{t("storesSection")}</p>
          <h3 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("storesTitle")}</h3>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredShops.slice(0, 6).map((shop) => (
              <li key={shop.slug}>
                <Link
                  href={`/shops/${shop.slug}`}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/90"
                >
                  {shop.logoUrl ? (
                    <Image
                      src={shop.logoUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-800">
                      {shop.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{shop.name}</p>
                    <p className="text-xs text-zinc-500">{t(`niches.${shop.nicheLabel}`)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/shops"
            className="mt-6 inline-flex text-sm font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            {t("allStores")}
          </Link>
        </div>
      ) : null}
    </section>
  )
}
