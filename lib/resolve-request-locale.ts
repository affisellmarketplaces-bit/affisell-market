import { cookies, headers } from "next/headers"
import { hasLocale } from "next-intl"

import { routing } from "@/i18n/routing"
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { localeFromPathname } from "@/lib/locale-path"

/**
 * Server locale resolution (single source of truth):
 * 1. `/fr` in URL → French (marketing routes)
 * 2. `affisell_locale` cookie → user choice (all routes, including /shops)
 * 3. next-intl request hint (middleware / Accept-Language)
 * 4. default `en`
 */
export async function resolveRequestLocale(requested: string | undefined): Promise<AppLocale> {
  const headersList = await headers()
  const pathname = headersList.get("x-affisell-pathname") ?? ""
  const pathLocale = localeFromPathname(pathname)
  if (pathLocale && hasLocale(routing.locales, pathLocale)) {
    return pathLocale as AppLocale
  }

  const cookieStore = await cookies()
  const cookieRaw =
    cookieStore.get(LOCALE_COOKIE)?.value ?? cookieStore.get("NEXT_LOCALE")?.value
  if (cookieRaw && hasLocale(routing.locales, cookieRaw)) {
    return cookieRaw as AppLocale
  }

  if (requested && hasLocale(routing.locales, requested)) {
    return requested as AppLocale
  }

  return DEFAULT_LOCALE
}
