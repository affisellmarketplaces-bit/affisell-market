/**
 * Server-side reading of the visitor's analytics consent, from the request's Cookie header (founder decision D1,
 * 2026-11-23: every behavioural write — new spine AND legacy tracking — must respect it).
 *
 * Mirrors what the browser reads (`readCookieConsentPrefsFromDocument`, lib/legal/cookie-consent-runtime.ts), but
 * FAILS CLOSED where the browser is lenient:
 *  - the granular cookie `affisell_cookie_prefs` (URL-encoded JSON) decides when present; `analytics` must be the
 *    boolean `true` (the browser's `Boolean(o.analytics)` would read the string "false" as true);
 *  - a granular cookie that is present but unreadable = NO consent (the browser would fall back to the banner cookie);
 *  - only when the granular cookie is absent does the legacy banner cookie `affisell_cookie_consent` count:
 *    "true" = everything accepted (what the old banner meant), anything else = no consent.
 * No cookie at all = no consent.
 *
 * Pure: no Prisma, no next/headers — callable from any route with `req.headers.get("cookie")`.
 */
import { COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_PREFS_COOKIE } from "@/lib/legal/consent"

/** Parses a Cookie header into name → decoded value. First occurrence wins (as browsers send the most specific first). */
export function parseCookieHeader(header: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>()
  if (!header || typeof header !== "string") return out
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    const name = part.slice(0, eq).trim()
    if (!name || out.has(name)) continue
    const raw = part.slice(eq + 1).trim()
    let value = raw
    try {
      value = decodeURIComponent(raw)
    } catch {
      value = raw
    }
    out.set(name, value)
  }
  return out
}

export type ConsentReading = "granted" | "denied" | "absent" | "unreadable"

/** What the cookies say about ANALYTICS consent, with the reason (for tests and logs — never personal data). */
export function readAnalyticsConsent(cookieHeader: string | null | undefined): ConsentReading {
  const cookies = parseCookieHeader(cookieHeader)
  const prefs = cookies.get(COOKIE_CONSENT_PREFS_COOKIE)
  if (prefs !== undefined) {
    let parsed: unknown
    try {
      parsed = JSON.parse(prefs)
    } catch {
      return "unreadable"
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "unreadable"
    return (parsed as { analytics?: unknown }).analytics === true ? "granted" : "denied"
  }
  const banner = cookies.get(COOKIE_CONSENT_COOKIE)
  if (banner === undefined) return "absent"
  if (banner === "true") return "granted"
  if (banner.startsWith("{")) {
    try {
      const parsed = JSON.parse(banner) as { analytics?: unknown } | null
      return parsed && typeof parsed === "object" && parsed.analytics === true ? "granted" : "denied"
    } catch {
      return "unreadable"
    }
  }
  return "denied"
}

/** True ONLY when the visitor explicitly accepted analytics. */
export function analyticsConsentFromCookieHeader(cookieHeader: string | null | undefined): boolean {
  return readAnalyticsConsent(cookieHeader) === "granted"
}

/**
 * Account id kept on a LEGACY view row (`/api/track`, `/api/pulse/view`). Its only readers count distinct RESELLERS
 * who looked at a product (`*-opportunity-pulse.ts`, `supplier-product-opportunity.ts` all filter role AFFILIATE), so a
 * buyer's or a supplier's account id is never stored: data minimisation with no loss for those readers.
 */
export function legacyTrackingUserId(user: { id?: string | null; role?: string | null } | null | undefined): string | null {
  return user?.role === "AFFILIATE" && typeof user.id === "string" && user.id ? user.id : null
}
