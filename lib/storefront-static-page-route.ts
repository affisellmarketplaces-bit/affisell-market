import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { loadAffiliateShopStoreCached } from "@/lib/shop-storefront-cache"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import {
  DEFAULT_STATIC_PAGES,
  getEnabledStaticPages,
  type StorefrontStaticPageKind,
} from "@/lib/storefront-static-pages-shared"

export async function resolveStoreStaticPage(slug: string, kind: StorefrontStaticPageKind) {
  const store = await loadAffiliateShopStoreCached(slug)
  if (!store) notFound()

  const page = store.theme.staticPages?.[kind]
  if (!page?.enabled) notFound()

  const hdrs = await headers()
  const isCustomDomain = isCustomDomainHeaders(hdrs)
  const shopHomePath = isCustomDomain ? "/" : `/shops/${slug}`

  return {
    store,
    page,
    shopHomePath,
    enabledKinds: getEnabledStaticPages(store.theme.staticPages ?? DEFAULT_STATIC_PAGES),
    isCustomDomain,
  }
}
