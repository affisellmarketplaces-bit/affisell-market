"use client"

import { useEffect, useMemo, useState } from "react"

import Link from "next/link"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { ProductCard, type ProductCardDisplayMode } from "@/components/ProductCard"
import { ProductCardPreviewToggle } from "@/components/product/ProductCardPreviewToggle"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { usePreviewAsCustomer } from "@/hooks/usePreviewAsCustomer"
import { useUserRole } from "@/hooks/useUserRole"
import { canShowBusinessProductData } from "@/lib/user-role"
import { MarketplaceFilters } from "@/components/marketplace/filters"
import { MarketplaceAffisellPulse } from "@/components/marketplace/MarketplaceAffisellPulse"
import { MarketplaceDepartmentRail } from "@/components/marketplace/MarketplaceDepartmentRail"
import { Sidebar } from "@/components/marketplace/Sidebar"
import { MARKETPLACE_QUERY_RESERVED } from "@/lib/marketplace-attribute-filters"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { Button, buttonVariants } from "@/components/ui/button"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

type ProductRow = Record<string, unknown>

function normalizeProducts(raw: unknown): ProductRow[] {
  const list: unknown = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && raw !== null && "products" in raw
      ? (raw as { products: unknown }).products
      : null
  if (!Array.isArray(list)) return []
  return list.map((p) => {
    const o = p as Record<string, unknown>
    return {
      ...o,
      title: o.title ?? o.name,
      price:
        o.price ??
        (typeof o.sellingPriceCents === "number" ? (o.sellingPriceCents as number) / 100 : undefined),
      image: o.image ?? (Array.isArray(o.images) ? o.images[0] : undefined),
    }
  })
}

type MarketplaceViewProps = {
  /** Catalog browse base path (affiliate dashboard vs legacy /marketplace). */
  basePath?: string
  /** Affiliate catalog shows margins; customer browse never does. */
  audience?: "affiliate" | "customer"
  /** Home embed: hide page header (hero is above). */
  embedded?: boolean
}

export function MarketplaceView({
  basePath = "/shops/browse",
  audience = "customer",
  embedded = false,
}: MarketplaceViewProps = {}) {
  const t = useTranslations("marketplace.browse")
  const router = useRouter()
  const searchParams = useSearchParams()
  const userRole = useUserRole()
  const previewAsCustomer = usePreviewAsCustomer()
  const isAffiliateCatalog = audience === "affiliate" || basePath === AFFILIATE_CATALOG_PATH
  const isCustomerBrowse = audience === "customer"
  const showBusinessData =
    !isCustomerBrowse &&
    (isAffiliateCatalog || (canShowBusinessProductData(userRole) && !previewAsCustomer))
  const productCardMode: ProductCardDisplayMode = showBusinessData
    ? userRole === "supplier"
      ? "supplier"
      : "affiliate"
    : "customer"
  const categoryId = searchParams.get("category")
  const subcategoryId = searchParams.get("subcategory")
  const searchQuery = searchParams.get("q") ?? ""

  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dbUnavailable, setDbUnavailable] = useState<string | null>(null)

  const attributeFilterKeys = useMemo(() => {
    const keys: string[] = []
    for (const key of searchParams.keys()) {
      if (!MARKETPLACE_QUERY_RESERVED.has(key)) keys.push(key)
    }
    return keys
  }, [searchParams])

  useEffect(() => {
    const qs = searchParams.toString()
    setLoading(true)
    setDbUnavailable(null)
    const url = qs ? `/api/marketplace/products?${qs}` : `/api/marketplace/products`

    fetch(url)
      .then(async (r) => {
        const data = (await r.json()) as {
          products?: unknown
          dbUnavailable?: boolean
          error?: string
        }
        setProducts(normalizeProducts(data))
        if (data.dbUnavailable && data.error) setDbUnavailable(data.error)
        else if (!r.ok) setDbUnavailable(data.error ?? "Could not load listings")
      })
      .catch(() => {
        setProducts([])
        setDbUnavailable("Could not load listings")
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  const handleCategoryClick = (catId: string, subId?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of [...params.keys()]) {
      if (!MARKETPLACE_QUERY_RESERVED.has(key)) params.delete(key)
    }
    params.delete("category")
    params.delete("subcategory")
    params.delete("categoryId")
    params.delete("subcategoryId")
    if (subId) {
      params.set("subcategory", subId)
    } else {
      params.set("category", catId)
    }
    const s = params.toString()
    router.push(`${basePath}${s ? `?${s}` : ""}`)
  }

  const hasFilters = Boolean(
    categoryId || subcategoryId || searchQuery.trim() || attributeFilterKeys.length > 0
  )

  function clearFilters() {
    router.push(basePath)
  }

  const Shell = embedded ? "section" : "main"

  return (
    <Shell
      id={embedded ? "explorer" : undefined}
      aria-label={embedded ? t("ariaEmbedded") : undefined}
      className={cn(
        "text-zinc-900 dark:text-zinc-50",
        embedded ? "scroll-mt-24" : "min-h-[calc(100dvh-3.75rem)]"
      )}
    >
      <div className={cn("mx-auto max-w-7xl", embedded ? "py-2" : "px-4 py-8 md:px-8 md:py-10")}>
        {!embedded ? (
        <header className={affisellBrand.headerShell}>
          <div className={affisellBrand.headerMesh} aria-hidden />
          <div className="relative space-y-6 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.14em]",
                    isAffiliateCatalog
                      ? "text-violet-700 dark:text-violet-300"
                      : affisellBrand.eyebrowBuyer
                  )}
                >
                  {isAffiliateCatalog ? t("eyebrowCatalog") : t("eyebrowBuyer")}
                </p>
                <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                  {isAffiliateCatalog ? t("titleCatalog") : t("titleBuyer")}
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
                  {isAffiliateCatalog ? t("subtitleCatalog") : t("subtitleBuyer")}
                </p>
              </div>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="shrink-0 gap-1.5 border-zinc-200/90 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/80"
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t("resetFilters")}
                </Button>
              ) : null}
            </div>

            <form
              className="max-w-xl"
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const next = new URLSearchParams(searchParams.toString())
                const localQ = String(fd.get("localQ") ?? "").trim()
                if (localQ) next.set("q", localQ)
                else next.delete("q")
                const s = next.toString()
                router.push(`${basePath}${s ? `?${s}` : ""}`)
              }}
            >
              <label htmlFor="marketplace-local-search" className="sr-only">
                {isAffiliateCatalog ? t("searchCatalog") : t("searchProduct")}
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <input
                  id="marketplace-local-search"
                  name="localQ"
                  type="search"
                  defaultValue={searchQuery}
                  placeholder={
                    isAffiliateCatalog ? t("placeholderCatalog") : t("placeholderBuyer")
                  }
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-zinc-200/90 bg-white/95 py-2 pl-10 pr-3 text-sm text-zinc-900 shadow-sm outline-none ring-brand/15 placeholder:text-zinc-400 focus:border-brand focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                />
              </div>
            </form>
          </div>
        </header>
        ) : (
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
                  {t("embeddedEyebrow")}
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                  {t("embeddedTitle")}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                  {t("embeddedSubtitle")}
                </p>
              </div>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="shrink-0 gap-1.5"
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t("resetFilters")}
                </Button>
              ) : null}
            </div>
            {searchQuery.trim() ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("resultsFor")}{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">&ldquo;{searchQuery.trim()}&rdquo;</span>
              </p>
            ) : null}
          </div>
        )}

        <MarketplaceDepartmentRail
          activeCategoryId={categoryId}
          activeSubcategoryId={subcategoryId}
          catalogBasePath={basePath}
        />
        {!embedded ? (
          <MarketplaceAffisellPulse audience={isCustomerBrowse ? "buyer" : "default"} />
        ) : null}
        {!isAffiliateCatalog && !isCustomerBrowse ? (
          <ProductCardPreviewToggle className="mt-4" />
        ) : null}

        {dbUnavailable ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="font-semibold">{t("dbUnavailableTitle")}</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">{dbUnavailable}</p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[5.25rem] lg:w-[min(19rem,100%)] lg:max-w-[19rem] lg:self-start">
            <Sidebar
              onCategoryClick={handleCategoryClick}
              activeCategoryId={categoryId}
              activeSubcategoryId={subcategoryId}
            />
            <MarketplaceFilters categoryId={categoryId} subcategoryId={subcategoryId} />
          </aside>

          <div className="min-w-0 flex-1">
            {loading ? (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="animate-pulse">
                    <div className="aspect-square rounded-3xl border border-zinc-100 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-800/50" />
                    <div className="mt-3 h-4 w-3/4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                    <div className="mt-2 h-5 w-20 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                  </li>
                ))}
              </ul>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-violet-200/70 bg-white/80 px-6 py-16 text-center shadow-sm backdrop-blur-sm dark:border-violet-900/40 dark:bg-zinc-950/50">
                {dbUnavailable ? (
                  <>
                    <p className="text-lg font-medium text-amber-950 dark:text-amber-100">{t("dbEmptyTitle")}</p>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-amber-900/90 dark:text-amber-200/90">
                      {dbUnavailable}
                    </p>
                    <p className="mx-auto mt-3 max-w-lg text-xs text-zinc-600 dark:text-zinc-400">{t("dbDevHint")}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t("emptyListingTitle")}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                      {hasFilters ? t("emptyFilteredBody") : t("emptyDefaultBody")}
                    </p>
                    {hasFilters ? (
                      <Button type="button" className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={clearFilters}>
                        {t("showAll")}
                      </Button>
                    ) : (
                      <Link href="/shops" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6 inline-flex")}>
                        {t("viewStores")}
                      </Link>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {t("listingCount", { count: products.length })}
                </strong>
                {searchQuery.trim() ? t("listingCountForQuery", { query: searchQuery.trim() }) : null}
              </p>
            )}
            {!loading && products.length > 0 ? (
              <ul className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <li key={String(product.listingId ?? product.id)} className="flex h-full">
                    <ProductCard product={product} mode={productCardMode} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </Shell>
  )
}
