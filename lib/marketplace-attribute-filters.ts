/**
 * Client-safe marketplace filter helpers (no Prisma, no @prisma/client).
 * DB logic: `@/lib/marketplace-attribute-filters.server` + API routes.
 */

import {
  MARKETPLACE_CUSTOM_COLUMN_PREFIX,
  MARKETPLACE_QUERY_RESERVED,
} from "@/lib/marketplace-query-params"

export type { MarketplaceFacet, MarketplaceFacetValue } from "@/lib/marketplace-facet-types"
export {
  MARKETPLACE_CUSTOM_COLUMN_PREFIX,
  MARKETPLACE_QUERY_RESERVED,
} from "@/lib/marketplace-query-params"

const FACET_TYPES = new Set(["SELECT", "BOOLEAN", "YES_NO", "MULTI_SELECT", "MULTI"])

export function isFacetFilterableType(type: string): boolean {
  return FACET_TYPES.has(type.toUpperCase().replace(/\s+/g, "_"))
}

export function parseMarketplaceAttributeFilters(
  searchParams: URLSearchParams,
  allowedKeys?: Set<string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of searchParams.entries()) {
    if (MARKETPLACE_QUERY_RESERVED.has(key)) continue
    if (key.startsWith(MARKETPLACE_CUSTOM_COLUMN_PREFIX)) continue
    const value = raw.trim()
    if (!value) continue
    if (allowedKeys && !allowedKeys.has(key)) continue
    out[key] = value
  }
  return out
}
