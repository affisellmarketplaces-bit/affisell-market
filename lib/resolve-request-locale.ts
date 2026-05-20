import { cookies } from "next/headers"
import { hasLocale } from "next-intl"

import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { routing } from "@/i18n/routing"

/** Server-only: URL segment wins, then cookie, then default. */
export async function resolveRequestLocale(requested: string | undefined): Promise<AppLocale> {
  if (requested && hasLocale(routing.locales, requested)) {
    return requested as AppLocale
  }
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  return resolveAppLocale(fromCookie ?? DEFAULT_LOCALE)
}
