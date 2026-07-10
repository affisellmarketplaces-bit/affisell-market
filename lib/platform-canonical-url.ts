import { normalizeRequestHost } from "@/lib/custom-domain-host"
import { devLocalhostOrigin } from "@/lib/dev-localhost-url"
import { isLocalhostUrl } from "@/lib/localhost-host"

/** True for `*.vercel.app` deployment hosts (not merchant storefronts). */
export function isVercelAppHost(hostRaw: string | null | undefined): boolean {
  const host = normalizeRequestHost(hostRaw)
  if (!host) return false
  return host === "vercel.app" || host.endsWith(".vercel.app")
}

/** Canonical public origin for links, redirects, and checkout (never `*.vercel.app` in prod). */
export function canonicalPlatformOrigin(): string {
  const fromEnv =
    process.env.AFFISELL_PLATFORM_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim()
  if (fromEnv) {
    const normalized = fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`
    const origin = normalized.replace(/\/$/, "")
    if (!(process.env.VERCEL_ENV === "production" && isLocalhostUrl(origin))) {
      return origin
    }
  }
  if (process.env.VERCEL_ENV === "production") {
    return "https://affisell.com"
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`
  return devLocalhostOrigin()
}

export function canonicalPlatformHost(): string {
  try {
    return new URL(canonicalPlatformOrigin()).hostname.toLowerCase()
  } catch {
    return "affisell.com"
  }
}

/** Production-only: hide Vercel preview URLs and normalize `www` → apex. */
export function shouldRedirectToCanonicalPlatform(hostRaw: string | null | undefined): boolean {
  if (process.env.VERCEL_ENV !== "production") return false
  const host = normalizeRequestHost(hostRaw)
  if (!host) return false
  if (isVercelAppHost(host)) return true
  const canonical = canonicalPlatformHost()
  if (host === `www.${canonical}`) return true
  return false
}

export function canonicalPlatformRedirectUrl(
  hostRaw: string | null | undefined,
  pathname: string,
  search: string
): string | null {
  if (!shouldRedirectToCanonicalPlatform(hostRaw)) return null
  const origin = canonicalPlatformOrigin()
  return `${origin}${pathname}${search}`
}
