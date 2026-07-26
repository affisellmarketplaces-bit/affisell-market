/**
 * Affisell site origin — single source of truth for absolute URLs.
 *
 * Production / Preview: never returns localhost (even if env is mis-set).
 * Development: localhost via PORT / NEXT_PUBLIC_APP_URL.
 *
 * Prefer relative `/api/...` for same-origin browser fetches.
 * Use getSiteUrl() / getAbsoluteUrl() only for emails, OAuth redirects, webhooks, OG.
 */
import {
  publicAbsoluteUrl,
  resolvePublicAppUrl,
  rewriteLocalhostToPublic,
} from "@/lib/public-app-url"

export {
  isLocalhostHost,
  isLocalhostUrl,
  publicAbsoluteUrl,
  resolvePublicAppUrl,
  rewriteLocalhostToPublic,
  sanitizePublicLink,
} from "@/lib/public-app-url"

/** Canonical app origin without trailing slash. */
export function getSiteUrl(): string {
  return resolvePublicAppUrl()
}

/** Absolute URL on the public site (`path` may be absolute or relative). */
export function getAbsoluteUrl(path: string): string {
  return publicAbsoluteUrl(path)
}

/**
 * Resolve a base URL for OAuth / webhooks.
 * Explicit env wins when non-localhost (or in development); otherwise getSiteUrl().
 */
export function resolveConfiguredOrigin(
  ...candidates: Array<string | null | undefined>
): string {
  for (const raw of candidates) {
    const v = raw?.trim()
    if (!v) continue
    const normalized = v.startsWith("http") ? v.replace(/\/$/, "") : `https://${v.replace(/\/$/, "")}`
    // Always rewrite localhost → public when we would ship buyer/oauth links.
    return rewriteLocalhostToPublic(normalized).replace(/\/$/, "")
  }
  return getSiteUrl()
}
