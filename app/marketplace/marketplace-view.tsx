"use client"

import { useMemo } from "react"

import Link from "next/link"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { ProductCard, type ProductCardDisplayMode } from "@/components/ProductCard"
import { ProductCardPreviewToggle } from "@/components/product/ProductCardPreviewToggle"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { usePreviewAsCustomer } from "@/hooks/usePreviewAsCustomer"
import { useUserRole } from "@/hooks/useUserRole"
import { canShowBusinessProductData } from "@/lib/user-role"
import { MarketplaceFilters } from "@/components/marketplace/filters"
import { BuyerRegionBanner } from "@/components/marketplace/buyer-region-banner"
import { MarketplaceGraduatedShipsToBootstrap, skipGraduatedShipsToAutoFilter } from "@/components/marketplace/marketplace-graduated-ships-to-bootstrap"
import { MarketplaceShipsToChip } from "@/components/marketplace/marketplace-ships-to-chip"
import { isUsMarket } from "@/lib/market-config"
import { primaryRegionalShipsFromFacet } from "@/lib/market-region-shipping"
import { OfferModeQuickRail } from "@/components/marketplace/offer-mode-quick-rail"
import { MarketplaceBrowseDepartmentsRail } from "@/components/marketplace/marketplace-browse-departments-rail"
import { MarketplaceAffisellPulse } from "@/components/marketplace/MarketplaceAffisellPulse"
import { MobileCatalogChrome } from "@/components/marketplace/mobile-catalog-chrome"
import { MarketplaceDepartmentRail } from "@/components/marketplace/MarketplaceDepartmentRail"
import { BuyerBrowseSignalsRecorder } from "@/components/home/buyer-browse-signals-recorder"
import { HomePersonalizedPicksRail } from "@/components/home/home-personalized-picks-rail"
import { CategoryTreeExplorer } from "@/components/marketplace/CategoryTreeExplorer"
import { MarketplaceSearchBox } from "@/components/marketplace/MarketplaceSearchBox"
import { MARKETPLACE_QUERY_RESERVED } from "@/lib/marketplace-query-params"
import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { offerModeFilterLabel, parseOfferFacetValue } from "@/lib/product-offer-mode"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  catalogFilterHref,
  catalogFilterHrefFromParams,
  navigateMarketplaceCatalog,
} from "@/lib/marketplace-catalog-nav.client"
import { Button, buttonVariants } from "@/components/ui/button"
import { affisellBrand } from "@/lib/affisell-brand"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { cn } from "@/lib/utils"

type ProductRow = Record<string, unknown>

type CategoryNode = {
  id: string
  name: string
  fullPath?: string
  icon: string
  slug: string
  order: number
  count: number
  subcategories: { id: string; name: string; slug: string; count: number; fullPath?: string }[]
}

const categoryFetcher = (url: string) => fetch(url).then((r) => r.json())

type CatalogApiResponse = {
  products?: unknown
  dbUnavailable?: boolean
  error?: string
}

async function catalogFetcher(url: string): Promise<CatalogApiResponse> {
  const response = await fetch(url)
  const data = (await response.json()) as CatalogApiResponse
  if (!response.ok && !data.dbUnavailable) {
    throw new Error(data.error ?? "Could not load listings")
  }
  return data
}

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
  /** Home SSR: skip first client fetch for default catalog + categories. */
  initialBrowse?: HomeMarketplaceShell
}

export function MarketplaceView({
  basePath = "/shops/browse",
  audience = "customer",
  embedded = false,
  initialBrowse,
}: MarketplaceViewProps = {}) {
  const t = useTranslations("marketplace.browse")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryFallback = initialBrowse
    ? { categories: initialBrowse.categories as CategoryNode[], catalogTotal: initialBrowse.catalogTotal }
    : undefined

  const { data: categoryTree } = useSWR<{
    categories: CategoryNode[]
    catalogTotal?: number
  }>("/api/categories", () => categoryFetcher("/api/categories"), {
    fallbackData: categoryFallback,
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    revalidateOnMount: !categoryFallback,
  })

  const categoriesPayload = categoryTree ?? categoryFallback
  const userRole = useUserRole()
  const previewAsCustomer = usePreviewAsCustomer()
  const isAffiliateCatalog = audience === "affiliate" || basePath === AFFILIATE_CATALOG_PATH
  const isCustomerBrowse = audience === "customer"
  const mobileCatalogShell = embedded && isCustomerBrowse
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

  const productsApiUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (embedded && isCustomerBrowse) params.set("lite", "1")
    const qs = params.toString()
    if (qs) return `/api/marketplace/products?${qs}`
    if (embedded && isCustomerBrowse) return "/api/marketplace/products?lite=1"
    return "/api/marketplace/products"
  }, [searchParams, embedded, isCustomerBrowse])

  const useInitialFallback = Boolean(
    initialBrowse && embedded && isCustomerBrowse && searchParams.toString() === ""
  )

  const { data: catalogData, error: catalogError, isLoading, isValidating } = useSWR<CatalogApiResponse>(
    productsApiUrl,
    catalogFetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 3_000,
      revalidateOnMount: !useInitialFallback,
      fallbackData: useInitialFallback ? { products: initialBrowse!.products } : undefined,
    }
  )

  const products = useMemo(
    () => normalizeProducts(catalogData?.products ?? (useInitialFallback ? initialBrowse?.products : [])),
    [catalogData?.products, useInitialFallback, initialBrowse?.products]
  )

  const loading = isLoading && products.length === 0
  const refreshing = isValidating && products.length > 0
  const dbUnavailable =
    catalogData?.dbUnavailable && catalogData.error
      ? catalogData.error
      : catalogError instanceof Error
        ? catalogError.message
        : catalogError
          ? "Could not load listings"
          : null

  const attributeFilterKeys = useMemo(() => {
    const keys: string[] = []
    for (const key of searchParams.keys()) {
      if (!MARKETPLACE_QUERY_RESERVED.has(key)) keys.push(key)
    }
    return keys
  }, [searchParams])

  const handleCategoryClick = (nodeId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of [...params.keys()]) {
      if (!MARKETPLACE_QUERY_RESERVED.has(key)) params.delete(key)
    }
    params.delete("category")
    params.delete("subcategory")
    params.delete("categoryId")
    params.delete("subcategoryId")
    params.delete("dept")
    params.set("category", nodeId)
    navigateMarketplaceCatalog(router, catalogFilterHrefFromParams(basePath, params))
  }

  const offerFilter = searchParams.get(MARKETPLACE_OFFER_FACET_KEY)
  const priceFilter = searchParams.get("price")

  const hasFilters = Boolean(
    categoryId ||
      subcategoryId ||
      searchQuery.trim() ||
      attributeFilterKeys.length > 0 ||
      searchParams.get("shipsFrom") ||
      searchParams.get("shipsTo") ||
      searchParams.get("delivery") ||
      searchParams.get("freeShipping") ||
      offerFilter ||
      priceFilter
  )

  const scopeNodeId = subcategoryId ?? categoryId

  const { data: breadcrumbData } = useSWR<{ path: Array<{ id: string; name: string; fullPath: string }> }>(
    scopeNodeId ? `/api/categories/breadcrumb?id=${encodeURIComponent(scopeNodeId)}` : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false }
  )

  const activeScope = useMemo(() => {
    const roots = categoriesPayload?.categories ?? []
    const nodeId = scopeNodeId
    if (!nodeId) return { kind: "catalog" as const }

    if (breadcrumbData?.path?.length) {
      return { kind: "path" as const, path: breadcrumbData.path }
    }

    if (subcategoryId) {
      for (const root of roots) {
        const sub = root.subcategories.find((s) => s.id === subcategoryId)
        if (sub) return { kind: "sub" as const, parent: root, sub }
      }
    }
    if (categoryId) {
      const root = roots.find((c) => c.id === categoryId)
      if (root) return { kind: "root" as const, root }
    }
    return { kind: "node" as const, nodeId }
  }, [categoriesPayload?.categories, categoryId, subcategoryId, scopeNodeId, breadcrumbData?.path])

  const activeFilterLabel = useMemo(() => {
    if (offerFilter) {
      const mode = parseOfferFacetValue(offerFilter)
      const badge = mode ? offerModeFilterLabel(mode, locale as AppLocale) : null
      if (badge) return badge.shortLabel
    }
    if (activeScope.kind === "path") {
      const leaf = activeScope.path[activeScope.path.length - 1]
      return leaf?.fullPath ?? leaf?.name ?? t("activeFilterCatalog")
    }
    if (activeScope.kind === "sub") {
      return t("activeFilterSubcategory", {
        sub: activeScope.sub.name,
        parent: activeScope.parent.name,
      })
    }
    if (activeScope.kind === "root") {
      return t("activeFilterCategory", { name: activeScope.root.name })
    }
    if (activeScope.kind === "node") {
      return t("activeFilterCategory", { name: activeScope.nodeId })
    }
    return t("activeFilterCatalog")
  }, [activeScope, offerFilter, locale, t])

  const browseSignalCategoryName = useMemo(() => {
    if (activeScope.kind === "path") {
      const leaf = activeScope.path[activeScope.path.length - 1]
      return leaf?.name ?? null
    }
    if (activeScope.kind === "sub") return activeScope.sub.name
    if (activeScope.kind === "root") return activeScope.root.name
    return null
  }, [activeScope])

  const showPersonalizedRail = Boolean(
    embedded &&
      isCustomerBrowse &&
      !hasFilters &&
      (initialBrowse?.personalizedPicks?.items.length ?? 0) >= 4
  )

  function clearFilters() {
    skipGraduatedShipsToAutoFilter()
    navigateMarketplaceCatalog(router, catalogFilterHref(basePath))
  }

  function filterRegionalShipping() {
    const params = new URLSearchParams(searchParams.toString())
    params.set("shipsFrom", primaryRegionalShipsFromFacet())
    navigateMarketplaceCatalog(router, catalogFilterHrefFromParams(basePath, params))
  }

  const shipsFromFilter = searchParams.get("shipsFrom")
  const shipsToFilter = searchParams.get("shipsTo")
  const regionalShipsFacet = primaryRegionalShipsFromFacet()

  const Shell = embedded ? "section" : "main"

  return (
    <Shell
      id={embedded ? "explorer" : undefined}
      aria-label={embedded ? t("ariaEmbedded") : undefined}
      className={cn(
        "text-zinc-900 dark:text-zinc-50",
        embedded
          ? "scroll-mt-[calc(4.25rem+env(safe-area-inset-top,0px))] sm:scroll-mt-24"
          : "min-h-[calc(100dvh-3.75rem)]"
      )}
    >
      <MarketplaceGraduatedShipsToBootstrap
        basePath={basePath}
        enabled={audience === "customer"}
      />
      <div className={cn("mx-auto max-w-7xl", embedded ? "py-2 md:py-3" : "px-4 py-8 md:px-8 md:py-10")}>
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
                navigateMarketplaceCatalog(router, catalogFilterHrefFromParams(basePath, next))
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
        ) : mobileCatalogShell ? (
          <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                {t("embeddedEyebrow")}
              </p>
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">
                {t("embeddedTitleMobile")}
              </h2>
            </div>
            {hasFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="shrink-0 gap-1.5">
                <X className="h-4 w-4" aria-hidden />
                {t("resetFilters")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {embedded && searchQuery.trim() ? (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {t("resultsFor")}{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">&ldquo;{searchQuery.trim()}&rdquo;</span>
          </p>
        ) : null}

        {!embedded ? (
          <div className="mt-4 max-w-3xl">
            <MarketplaceSearchBox basePath={basePath} />
          </div>
        ) : searchQuery.trim() || hasFilters ? (
          <div className="mb-3 max-w-3xl md:hidden">
            <MarketplaceSearchBox basePath={basePath} />
          </div>
        ) : null}

        <MarketplaceDepartmentRail
          activeCategoryId={categoryId}
          activeSubcategoryId={subcategoryId}
          catalogBasePath={basePath}
          categoriesPayload={categoriesPayload}
        />
        {isCustomerBrowse ? (
          <MarketplaceBrowseDepartmentsRail
            activeCategoryId={categoryId}
            catalogBasePath={basePath}
            className={embedded ? "mt-3 hidden md:block" : "mt-3 sm:mt-4"}
          />
        ) : null}
        {embedded && isCustomerBrowse ? (
          <BuyerBrowseSignalsRecorder categoryName={browseSignalCategoryName} />
        ) : null}
        {showPersonalizedRail && initialBrowse?.personalizedPicks ? (
          <HomePersonalizedPicksRail picks={initialBrowse.personalizedPicks} className="mt-3 sm:mt-4" />
        ) : null}
        {!embedded ? (
          <div>
            {isCustomerBrowse ? (
              <>
                <BuyerRegionBanner className="mb-4" />
                <div className="mb-4">
                  <MarketplaceShipsToChip basePath={basePath} />
                </div>
                <OfferModeQuickRail
                  basePath={basePath}
                  className="mb-4"
                  initialCounts={initialBrowse?.offerRailCounts}
                />
              </>
            ) : null}
            <MarketplaceAffisellPulse audience={isCustomerBrowse ? "buyer" : "default"} />
          </div>
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

        <div
          className={cn(
            "flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8",
            embedded ? "mt-2 md:mt-4" : "mt-4 md:mt-8"
          )}
        >
          <aside className="hidden w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[5.25rem] lg:flex lg:w-[min(19rem,100%)] lg:max-w-[19rem] lg:self-start">
            <CategoryTreeExplorer
              onCategoryClick={handleCategoryClick}
              onShowFullCatalog={clearFilters}
              activeCategoryId={scopeNodeId}
              catalogTotal={categoriesPayload?.catalogTotal}
              categoriesPayload={categoriesPayload}
            />
            <MarketplaceFilters
              categoryId={categoryId}
              subcategoryId={subcategoryId}
              catalogBasePath={basePath}
              departmentNames={
                categoriesPayload?.categories
                  ? Object.fromEntries(categoriesPayload.categories.map((c) => [c.id, c.name]))
                  : undefined
              }
            />
          </aside>

          <div className="min-w-0 flex-1">
            {embedded && isCustomerBrowse ? (
              <>
                <BuyerRegionBanner className="mb-3 sm:mb-4" variant="compact" />
                <div className="mb-3 sm:mb-4">
                  <MarketplaceShipsToChip basePath={basePath} />
                </div>
                <OfferModeQuickRail
                  basePath={basePath}
                  className="mb-3 sm:mb-4"
                  initialCounts={initialBrowse?.offerRailCounts}
                />
              </>
            ) : null}
            {mobileCatalogShell ? (
              <MobileCatalogChrome
                productCount={products.length}
                loading={loading}
                hasFilters={hasFilters}
                activeFilterLabel={activeFilterLabel}
                onClearFilters={clearFilters}
                categoriesPanel={(close) => (
                  <CategoryTreeExplorer
                    onCategoryClick={(id) => {
                      handleCategoryClick(id)
                      close()
                    }}
                    onShowFullCatalog={() => {
                      clearFilters()
                      close()
                    }}
                    activeCategoryId={scopeNodeId}
                    catalogTotal={categoriesPayload?.catalogTotal}
                    categoriesPayload={categoriesPayload}
                    inSheet
                  />
                )}
                filtersPanel={
                  <MarketplaceFilters
                    categoryId={categoryId}
                    subcategoryId={subcategoryId}
                    catalogBasePath={basePath}
                    departmentNames={
                      categoriesPayload?.categories
                        ? Object.fromEntries(categoriesPayload.categories.map((c) => [c.id, c.name]))
                        : undefined
                    }
                    inSheet
                  />
                }
              />
            ) : null}
            {hasFilters ? (
              <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-100">
                  {activeFilterLabel}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full p-0.5 text-violet-700 hover:bg-violet-200/60 dark:text-violet-200"
                    aria-label={t("resetFilters")}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </div>
            ) : null}
            {loading ? (
              <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="animate-pulse">
                    <div className="aspect-square rounded-3xl border border-zinc-100 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-800/50" />
                    <div className="mt-3 h-4 w-3/4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                    <div className="mt-2 h-5 w-20 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                  </li>
                ))}
              </ul>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-violet-200/70 bg-gradient-to-b from-violet-50/50 via-white to-white px-6 py-16 text-center shadow-sm backdrop-blur-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950/50 dark:to-zinc-950/50">
                {dbUnavailable ? (
                  <>
                    <p className="text-lg font-medium text-amber-950 dark:text-amber-100">{t("dbEmptyTitle")}</p>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-amber-900/90 dark:text-amber-200/90">
                      {dbUnavailable}
                    </p>
                    <p className="mx-auto mt-3 max-w-lg text-xs text-zinc-600 dark:text-zinc-400">{t("dbDevHint")}</p>
                  </>
                ) : searchQuery.trim() ? (
                  <>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("emptySearchTitle")}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                      {t("emptySearchBody", { query: searchQuery.trim() })}
                    </p>
                    <Button type="button" className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={clearFilters}>
                      {t("showAll")}
                    </Button>
                  </>
                ) : activeScope.kind === "sub" ? (
                  <>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("emptySubcategoryTitle")}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                      {t("emptySubcategoryBody", {
                        sub: activeScope.sub.name,
                        parent: activeScope.parent.name,
                      })}
                    </p>
                    <Button type="button" className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={clearFilters}>
                      {t("showAll")}
                    </Button>
                  </>
                ) : activeScope.kind === "root" ? (
                  <>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("emptyCategoryTitle")}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                      {t("emptyCategoryBody", { name: activeScope.root.name })}
                    </p>
                    <Button type="button" className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={clearFilters}>
                      {t("showAll")}
                    </Button>
                  </>
                ) : hasFilters &&
                  (attributeFilterKeys.length > 0 ||
                    offerFilter ||
                    priceFilter ||
                    shipsToFilter ||
                    shipsFromFilter ||
                    searchParams.get("delivery") ||
                    searchParams.get("freeShipping")) ? (
                  <>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("emptyFilteredTitle")}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                      {t("emptyFilteredBody")}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                      <Button type="button" className="bg-violet-600 hover:bg-violet-700" onClick={clearFilters}>
                        {t("showAll")}
                      </Button>
                      {shipsFromFilter && shipsFromFilter !== regionalShipsFacet ? (
                        <Button type="button" variant="outline" onClick={filterRegionalShipping}>
                          {isUsMarket() ? t("tryRegionalShippingUs") : t("tryRegionalShipping")}
                        </Button>
                      ) : null}
                      {shipsToFilter ? (
                        <Button type="button" variant="outline" onClick={clearFilters}>
                          {t("clearShipsToFilter")}
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("emptyCatalogTitle")}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                      {t("emptyCatalogBody")}
                    </p>
                    <Link href="/shops" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6 inline-flex")}>
                      {t("viewStores")}
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="mb-4 hidden items-center gap-3 md:flex">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("listingCount", { count: products.length })}
                  </strong>
                  {searchQuery.trim() ? t("listingCountForQuery", { query: searchQuery.trim() }) : null}
                  {hasFilters && !searchQuery.trim() ? (
                    <span className="text-zinc-500 dark:text-zinc-400"> · {activeFilterLabel}</span>
                  ) : null}
                </p>
                {refreshing ? (
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-300" aria-live="polite">
                    …
                  </span>
                ) : null}
              </div>
            )}
            {products.length > 0 ? (
              <ul
                className={cn(
                  "affisell-product-grid grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4",
                  refreshing && "opacity-75 transition-opacity duration-150"
                )}
              >
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
