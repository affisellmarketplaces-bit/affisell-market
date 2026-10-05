/**
 * Remote image hosts `next/image` may optimize — the single source of truth for `next.config.ts` (images.remotePatterns)
 * and for <SafeImage>, which loads any OTHER host directly instead of crashing the page.
 *
 * Product images are stored with the source marketplace's CDN URL, so a new import source brings a new host. Every
 * pattern here is `https` + `pathname: "/**"` (enforced by a test) so the optimizer never becomes an open image proxy.
 */
export type RemoteImagePattern = { protocol: "https"; hostname: string; pathname: "/**" }

export const REMOTE_IMAGE_PATTERNS: readonly RemoteImagePattern[] = [
  { protocol: "https", hostname: "m.media-amazon.com", pathname: "/**" },
  { protocol: "https", hostname: "images-na.ssl-images-amazon.com", pathname: "/**" },
  { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
  { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
  { protocol: "https", hostname: "**.cloudfront.net", pathname: "/**" },
  { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
  { protocol: "https", hostname: "**.myshopify.com", pathname: "/**" },
  { protocol: "https", hostname: "**.supabase.co", pathname: "/**" },
  { protocol: "https", hostname: "api.qrserver.com", pathname: "/**" },
  { protocol: "https", hostname: "**.alicdn.com", pathname: "/**" }, // AliExpress / 1688 / Taobao (ae01, img, cbu01…)
  { protocol: "https", hostname: "**.aliexpress-media.com", pathname: "/**" },
  { protocol: "https", hostname: "**.kwcdn.com", pathname: "/**" }, // Temu
  { protocol: "https", hostname: "**.ltwebstatic.com", pathname: "/**" }, // Shein
]

/** Next's hostname matching: `**.` = one or more subdomain labels (not the bare apex), `*.` = exactly one, else exact. */
export function hostnameMatchesPattern(pattern: string, host: string): boolean {
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(2)
    return host.length > suffix.length && host.endsWith(suffix)
  }
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1)
    return host.length > suffix.length && host.endsWith(suffix) && !host.slice(0, -suffix.length).includes(".")
  }
  return host === pattern
}

export function isConfiguredRemoteImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return REMOTE_IMAGE_PATTERNS.some((p) => hostnameMatchesPattern(p.hostname, host))
}

/**
 * Can `next/image` optimize this string `src` without throwing? Local paths and data/blob URLs always; absolute URLs
 * only when `https` and the host is configured. Anything else (unknown CDN, `http:`, malformed) must be loaded as-is.
 */
export function canOptimizeImageSrc(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true
  if (src.startsWith("data:") || src.startsWith("blob:")) return true
  try {
    const url = new URL(src)
    return url.protocol === "https:" && isConfiguredRemoteImageHost(url.hostname)
  } catch {
    return false
  }
}
