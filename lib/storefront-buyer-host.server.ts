import "server-only"

import { headers } from "next/headers"

import {
  isCustomDomainHeaders,
  storeSlugFromHeaders,
  STORE_ROLE_HEADER,
} from "@/lib/storefront-request-headers"

/**
 * Reseller store slug when this request is served on an AFFILIATE store host (custom domain or store
 * subdomain), `null` on the platform. Platform buyer routes use it to switch to store-branded output.
 */
export async function getAffiliateStoreHostSlug(): Promise<string | null> {
  const hdrs = await headers()
  const slug = storeSlugFromHeaders(hdrs)
  if (!isCustomDomainHeaders(hdrs) || !slug || hdrs.get(STORE_ROLE_HEADER) !== "AFFILIATE") return null
  return slug
}
