import { getRequestConfig } from "next-intl/server"

import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = await resolveRequestLocale(requested)

  return {
    locale,
    timeZone: "Europe/Paris",
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
