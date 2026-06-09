import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  resolveLegacyMarketplaceIndexPath,
} from "@/lib/affiliate-routes"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

export const dynamic = "force-dynamic"

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

/** Legacy URL — role-based redirect to affiliate catalog or public shops. */
export default async function MarketplaceIndexRedirectPage({ searchParams }: PageProps) {
  const session = await auth()
  const role = session?.user?.role
  const target = resolveLegacyMarketplaceIndexPath(role)
  const params = toUrlSearchParams(await searchParams)
  if (target === PUBLIC_MARKETPLACE_BROWSE_PATH) {
    redirect(marketplaceCatalogHref("/", params))
  }
  const qs = params.toString()
  if (target === AFFILIATE_CATALOG_PATH) {
    redirect(qs ? `${AFFILIATE_CATALOG_PATH}?${qs}` : AFFILIATE_CATALOG_PATH)
  }
  redirect(qs ? `${target}?${qs}` : target)
}
