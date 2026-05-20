import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import { hasLocale } from "next-intl"

import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { routing } from "@/i18n/routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  let locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  if (!hasLocale(routing.locales, requested)) {
    const cookieStore = await cookies()
    const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
    if (fromCookie) locale = resolveAppLocale(fromCookie)
  }

  return {
    locale,
    timeZone: "Europe/Paris",
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
