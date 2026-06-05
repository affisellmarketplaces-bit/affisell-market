/** Client-safe discovery facet keys (no Prisma). */

export const MARKETPLACE_PRICE_FACET_KEY = "price"
export const MARKETPLACE_SHIPS_FACET_KEY = "shipsFrom"
export const MARKETPLACE_DELIVERY_FACET_KEY = "delivery"
export const MARKETPLACE_FREE_SHIP_FACET_KEY = "freeShipping"
export const MARKETPLACE_DEPT_FACET_KEY = "dept"
export const MARKETPLACE_OFFER_FACET_KEY = "offer"

export const DISCOVERY_FACET_KEYS = new Set([
  MARKETPLACE_PRICE_FACET_KEY,
  MARKETPLACE_SHIPS_FACET_KEY,
  MARKETPLACE_DELIVERY_FACET_KEY,
  MARKETPLACE_FREE_SHIP_FACET_KEY,
  MARKETPLACE_DEPT_FACET_KEY,
  MARKETPLACE_OFFER_FACET_KEY,
])

/** Parse `dept` URL facet value to a category node id. */
export function parseDeptFacetValue(raw: string): string {
  return raw.split("|")[0]?.trim() ?? raw.trim()
}
