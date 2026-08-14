/** Buyer-facing affiliate storefront URLs — always the designed /boutique experience. */

const AFFILIATE_SHOP_LEGACY_PREFIX = "/shops/"

const PRESERVED_AFFILIATE_SHOP_SUFFIXES = [
  "/login",
  "/signup",
  "/account",
  "/about",
  "/faq",
  "/returns",
] as const

export function affiliateBuyerStorefrontHomePath(storeSlug: string): string {
  const slug = storeSlug.trim()
  return `/boutique/${encodeURIComponent(slug)}`
}

export function affiliateBuyerStorefrontProductPath(
  storeSlug: string,
  listingId: string,
  extraQuery?: Record<string, string | null | undefined>
): string {
  const base = affiliateBuyerStorefrontHomePath(storeSlug)
  const params = new URLSearchParams()
  params.set("productId", listingId.trim())
  for (const [key, value] of Object.entries(extraQuery ?? {})) {
    if (value != null && String(value).trim()) {
      params.set(key, String(value).trim())
    }
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}


function isPreservedAffiliateShopSubpath(subpath: string): boolean {
  return PRESERVED_AFFILIATE_SHOP_SUFFIXES.some(
    (suffix) => subpath === suffix || subpath.startsWith(`${suffix}/`)
  )
}

/**
 * Maps legacy `/shops/:slug` buyer URLs to `/boutique/:slug`.
 * Auth + static Brand Studio pages stay on `/shops/`.
 */
export function resolveAffiliateShopToBoutiqueRedirect(barePath: string): string | null {
  const bare = barePath || "/"
  if (!bare.startsWith(AFFILIATE_SHOP_LEGACY_PREFIX)) return null

  const rest = bare.slice(AFFILIATE_SHOP_LEGACY_PREFIX.length)
  if (!rest || rest === "browse" || rest.startsWith("browse/")) return null

  const segments = rest.split("/").filter(Boolean)
  const slug = segments[0]
  if (!slug) return null

  if (segments.length === 1) {
    return affiliateBuyerStorefrontHomePath(slug)
  }

  const subpath = `/${segments.slice(1).join("/")}`
  if (isPreservedAffiliateShopSubpath(subpath)) return null

  if (segments.length === 3 && segments[1] === "product" && segments[2]) {
    return affiliateBuyerStorefrontProductPath(slug, segments[2])
  }

  return null
}
