"use client"

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

type CatalogParams =
  | URLSearchParams
  | { category?: string; subcategory?: string; q?: string }
  | undefined

/** Buyer home catalog (`/?…#explorer`) — scrolls to results after navigation. */
export function navigateBuyerHomeCatalog(
  router: AppRouterInstance,
  params?: CatalogParams,
  options?: { scrollToExplorer?: boolean }
): void {
  const href = marketplaceCatalogHref("/", params)
  router.push(href)
  if (options?.scrollToExplorer === false) return
  document.getElementById("explorer")?.scrollIntoView({ behavior: "auto", block: "start" })
}
