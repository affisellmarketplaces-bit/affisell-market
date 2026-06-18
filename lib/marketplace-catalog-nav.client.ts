"use client"

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

type CatalogParams =
  | URLSearchParams
  | { category?: string; subcategory?: string; q?: string; shipsTo?: string }
  | undefined

const NO_SCROLL = { scroll: false } as const

/** In-app catalog URL — no #explorer hash (keeps scroll position on filter toggles). */
export function catalogFilterHref(catalogBasePath: string, queryString?: string): string {
  const base = catalogBasePath.replace(/\/$/, "") || "/"
  const qs = queryString?.replace(/^\?/, "") ?? ""
  return qs ? `${base}?${qs}` : base
}

export function catalogFilterHrefFromParams(
  catalogBasePath: string,
  params: URLSearchParams
): string {
  return catalogFilterHref(catalogBasePath, params.toString())
}

/** Soft navigation — updates query string + SWR, no scroll jump. */
export function navigateMarketplaceCatalog(
  router: AppRouterInstance,
  href: string,
  options?: { method?: "push" | "replace" }
): void {
  const method = options?.method ?? "push"
  if (method === "replace") {
    router.replace(href, NO_SCROLL)
  } else {
    router.push(href, NO_SCROLL)
  }
}

/** Buyer home catalog from hero/search — scrolls to #explorer once. */
export function navigateBuyerHomeCatalog(
  router: AppRouterInstance,
  params?: CatalogParams,
  options?: { scrollToExplorer?: boolean; method?: "push" | "replace" }
): void {
  const href = marketplaceCatalogHref("/", params)
  navigateMarketplaceCatalog(router, href, { method: options?.method ?? "push" })
  if (options?.scrollToExplorer === false) return
  requestAnimationFrame(() => {
    document.getElementById("explorer")?.scrollIntoView({ behavior: "auto", block: "start" })
  })
}
