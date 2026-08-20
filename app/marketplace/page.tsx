import { Suspense } from "react"
import { redirect } from "next/navigation"

import ShopsBrowseLoading from "@/app/shops/browse/loading"
import { auth } from "@/auth"
import {
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  resolveLegacyMarketplaceIndexPath,
} from "@/lib/affiliate-routes"
import { BrowseCatalogExplorer } from "@/components/shops/browse-catalog-explorer"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Marketplace — Affisell",
  description: "Parcourez les annonces des boutiques revendeur Affisell.",
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toUrlSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value)
    else if (Array.isArray(value) && value[0]) params.set(key, value[0])
  }
  return params
}

/**
 * Legacy `/marketplace` — render public catalog inline (no redirect flash).
 * Affiliates/suppliers still redirect to their dashboard catalog.
 */
export default async function MarketplaceIndexPage({ searchParams }: PageProps) {
  const session = await auth()
  const role = session?.user?.role
  const target = resolveLegacyMarketplaceIndexPath(role)
  const params = toUrlSearchParams(await searchParams)

  if (target === PUBLIC_MARKETPLACE_BROWSE_PATH) {
    return (
      <Suspense fallback={<ShopsBrowseLoading />}>
        <BrowseCatalogExplorer />
      </Suspense>
    )
  }

  const qs = params.toString()
  if (target === AFFILIATE_CATALOG_PATH) {
    redirect(qs ? `${AFFILIATE_CATALOG_PATH}?${qs}` : AFFILIATE_CATALOG_PATH)
  }
  redirect(qs ? `${target}?${qs}` : target)
}
