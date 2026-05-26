import { cookies, headers } from "next/headers"
import { hasLocale } from "next-intl"

import { routing } from "@/i18n/routing"
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { localeFromPathname } from "@/lib/locale-path"

function isDynamicServerUsageError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const digest = "digest" in error ? String((error as { digest?: string }).digest) : ""
  if (digest === "DYNAMIC_SERVER_USAGE") return true
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("DYNAMIC_SERVER_USAGE") ||
    message.includes("couldn't be rendered statically") ||
    message.includes("used `headers`") ||
    message.includes("used `cookies`")
  )
}

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
 * 1. `[locale]` segment / next-intl `requestLocale` (static-safe)
 * 2. `/fr` in `x-affisell-pathname` (runtime)
 * 3. `affisell_locale` cookie (runtime)
 * 4. default `en`
 */
export async function resolveRequestLocale(requested: string | undefined): Promise<AppLocale> {
  if (requested && hasLocale(routing.locales, requested)) {
    return requested as AppLocale
  }

  const pathname = await pathnameFromRequestHeaders()
  const pathLocale = localeFromPathname(pathname)
  if (pathLocale && hasLocale(routing.locales, pathLocale)) {
    return pathLocale as AppLocale
  }

  const cookieLocale = await localeFromRequestCookies()
  if (cookieLocale) return cookieLocale

  return DEFAULT_LOCALE
}

export { isDynamicServerUsageError }
