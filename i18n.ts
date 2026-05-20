import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  const fromEnv = process.env.NEXT_PUBLIC_MESSAGES_LOCALE
  const locale = resolveAppLocale(fromCookie ?? fromEnv ?? DEFAULT_LOCALE)
  const messages =
    locale === "fr"
      ? (await import("./messages/fr.json")).default
      : (await import("./messages/en.json")).default

  return {
    locale,
    /** EU-first — align server date formatting with storefront (`lib/market-config`). */
    timeZone: "Europe/Paris",
    messages,
  }
})
