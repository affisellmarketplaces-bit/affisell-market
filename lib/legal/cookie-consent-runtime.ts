import { Cookies } from "react-cookie-consent"

import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_PREFS_COOKIE,
  type CookieConsentPrefs,
  parseCookieConsent,
} from "@/lib/legal/consent"

/** 6 mois max — recommandation CNIL 2024. */
export const COOKIE_CONSENT_MAX_AGE_DAYS = 180

export const COOKIE_CONSENT_GRANTED_EVENT = "cookieConsentGranted"
export const COOKIE_CONSENT_CHANGED_EVENT = "affisell:cookie-consent"

export function readCookieConsentPrefsFromDocument(): CookieConsentPrefs | null {
  if (typeof document === "undefined") return null

  const prefsRaw = readRawCookie(COOKIE_CONSENT_PREFS_COOKIE)
  const prefsParsed = prefsRaw ? parseCookieConsent(safeJsonParse(prefsRaw)) : null
  if (prefsParsed) return prefsParsed

  const bannerRaw = readRawCookie(COOKIE_CONSENT_COOKIE)
  if (bannerRaw === "true") {
    return {
      essential: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    }
  }
  if (bannerRaw === "false") {
    return {
      essential: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    }
  }
  if (bannerRaw?.startsWith("{")) {
    return parseCookieConsent(safeJsonParse(bannerRaw))
  }
  return null
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsentPrefsFromDocument()?.analytics === true
}

export function persistCookieConsentPrefs(prefs: CookieConsentPrefs): void {
  const maxAge = COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60
  const optionalGranted = prefs.analytics || prefs.marketing
  const bannerValue = optionalGranted ? "true" : "false"

  document.cookie = `${COOKIE_CONSENT_PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))};path=/;max-age=${maxAge};SameSite=Lax`
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${bannerValue};path=/;max-age=${maxAge};SameSite=Lax`

  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: prefs }))
  if (optionalGranted) {
    document.dispatchEvent(new Event(COOKIE_CONSENT_GRANTED_EVENT))
  }
}

export function applyGtagConsent(prefs: Pick<CookieConsentPrefs, "analytics" | "marketing">): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  const analyticsGranted = prefs.analytics ? "granted" : "denied"
  const adGranted = prefs.marketing ? "granted" : "denied"
  window.gtag("consent", "update", {
    analytics_storage: analyticsGranted,
    ad_storage: adGranted,
    functionality_storage: analyticsGranted,
  })
}

export function removeNonEssentialCookies(): void {
  if (typeof document === "undefined") return
  const host = window.location.hostname
  const names = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean)

  for (const name of names) {
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name.startsWith("_gat")) {
      Cookies.remove(name, { path: "/" })
      Cookies.remove(name, { path: "/", domain: host })
      Cookies.remove(name, { path: "/", domain: `.${host}` })
    }
  }
}

export async function syncConsentToAccount(prefs: CookieConsentPrefs): Promise<void> {
  try {
    await fetch("/api/gdpr/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    })
  } catch (e) {
    console.error("[cookie-consent]", {
      result: "sync_failed",
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export function applyConsentChoice(prefs: CookieConsentPrefs): void {
  persistCookieConsentPrefs(prefs)
  applyGtagConsent(prefs)
  if (!prefs.analytics && !prefs.marketing) {
    removeNonEssentialCookies()
  } else {
    document.dispatchEvent(new Event(COOKIE_CONSENT_GRANTED_EVENT))
  }
  void syncConsentToAccount(prefs)
  console.log("[cookie-consent]", {
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    result: "saved",
  })
}

function readRawCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
