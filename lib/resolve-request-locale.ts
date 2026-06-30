import { cookies, headers } from "next/headers"
import { hasLocale } from "next-intl"

import { routing } from "@/i18n/routing"
import { isDynamicServerUsageError } from "@/lib/dynamic-server-error"
import { DEFAULT_LOCALE, LOCALE_COOKIE, type AppLocale } from "@/lib/i18n-locale"
import { localeFromPathname } from "@/lib/locale-path"

async function pathnameFromRequestHeaders(): Promise<string> {
  try {
    const headersList = await headers()
    return headersList.get("x-affisell-pathname") ?? ""
  } catch {
    return ""
  }
}

async function localeFromRequestCookies(): Promise<AppLocale | null> {
  try {
    const cookieStore = await cookies()
    const cookieRaw = cookieStore.get(LOCALE_COOKIE)?.value
    if (cookieRaw && hasLocale(routing.locales, cookieRaw)) {
      return cookieRaw as AppLocale
    }
  } catch {
    /* static prerender — no request store */
  }
  return null
}

/**
 * Server locale resolution (single source of truth):
 * 1. `/fr` (or `/en`) in `x-affisell-pathname` — explicit URL
 * 2. `affisell_locale` cookie — user preference on cookie-driven routes
 * 3. next-intl `requestLocale` / `[locale]` segment (static pages)
 * 4. default `en`
 *
 * Cookie must win over next-intl default on `/marketplace`, `/dashboard`, etc.
 * Otherwise LocaleServerSync would reload again after a language switch (visible flicker).
 */
export async function resolveRequestLocale(requested: string | undefined): Promise<AppLocale> {
  const pathname = await pathnameFromRequestHeaders()
  const pathLocale = localeFromPathname(pathname)
  if (pathLocale && hasLocale(routing.locales, pathLocale)) {
    return pathLocale as AppLocale
  }

  const cookieLocale = await localeFromRequestCookies()
  if (cookieLocale) return cookieLocale

  if (requested && hasLocale(routing.locales, requested)) {
    return requested as AppLocale
  }

  return DEFAULT_LOCALE
}

export { isDynamicServerUsageError }
