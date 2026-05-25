/** Headers set by middleware for custom-domain storefront requests. */

export const CUSTOM_DOMAIN_HEADER = "x-affisell-custom-domain"
export const STORE_SLUG_HEADER = "x-affisell-store-slug"
export const STORE_ROLE_HEADER = "x-affisell-store-role"

export function isCustomDomainHeaders(headers: Headers): boolean {
  return headers.get(CUSTOM_DOMAIN_HEADER) === "1"
}

export function storeSlugFromHeaders(headers: Headers): string | null {
  const v = headers.get(STORE_SLUG_HEADER)?.trim()
  return v || null
}
