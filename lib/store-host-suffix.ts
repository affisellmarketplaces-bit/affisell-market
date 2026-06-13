/** Auto-assigned merchant storefront host — Edge-safe (no Prisma). */

const DEFAULT_PROD_SUFFIX = "shops.affisell.com"
const DEFAULT_DEV_SUFFIX = "shops.localhost"

export function storeHostSuffix(): string {
  const fromEnv = process.env.AFFISELL_STORE_HOST_SUFFIX?.trim()
  if (fromEnv) return fromEnv.toLowerCase().replace(/\.$/, "")
  if (process.env.NODE_ENV === "development") return DEFAULT_DEV_SUFFIX
  return DEFAULT_PROD_SUFFIX
}

export function isStoreSubdomainEnabled(): boolean {
  return process.env.AFFISELL_STORE_SUBDOMAIN_DISABLED !== "1"
}

/** `{slug}.shops.affisell.com` host (slug must already be normalized). */
export function storeSubdomainHost(slug: string): string {
  return `${slug}.${storeHostSuffix()}`
}

const SLUG_FROM_HOST =
  /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

/** Extract store slug when host is `{slug}.{storeHostSuffix()}`. */
export function parseStoreSlugFromStoreHost(hostRaw: string | null | undefined): string | null {
  if (!hostRaw || typeof hostRaw !== "string") return null
  const host = hostRaw.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
  if (!host) return null

  const suffix = storeHostSuffix()
  const needle = `.${suffix}`
  if (!host.endsWith(needle) || host.length <= needle.length) return null

  const slug = host.slice(0, -needle.length)
  if (!slug || !SLUG_FROM_HOST.test(slug)) return null
  return slug
}

export function isAffisellStoreSubdomainHost(hostRaw: string | null | undefined): boolean {
  return parseStoreSlugFromStoreHost(hostRaw) !== null
}
