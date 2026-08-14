import { redirect } from "next/navigation"

import {
  affiliateBuyerStorefrontHomePath,
  affiliateBuyerStorefrontProductPath,
} from "@/lib/boutique/affiliate-buyer-storefront-path"

function appendQuery(path: string, searchParams: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    const trimmed = value?.trim()
    if (trimmed) params.set(key, trimmed)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Server redirect — buyers always land on the designed /boutique canvas. */
export function redirectAffiliateShopHomeToBoutique(
  slug: string,
  searchParams: Record<string, string | undefined> = {}
): never {
  redirect(appendQuery(affiliateBuyerStorefrontHomePath(slug), searchParams))
}

export function redirectAffiliateShopProductToBoutique(
  slug: string,
  listingId: string,
  searchParams: Record<string, string | undefined> = {}
): never {
  const params = new URLSearchParams()
  params.set("productId", listingId.trim())
  for (const [key, value] of Object.entries(searchParams)) {
    const trimmed = value?.trim()
    if (trimmed) params.set(key, trimmed)
  }
  const base = affiliateBuyerStorefrontHomePath(slug)
  const qs = params.toString()
  redirect(qs ? `${base}?${qs}` : affiliateBuyerStorefrontProductPath(slug, listingId))
}
