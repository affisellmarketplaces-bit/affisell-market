import { getRequestConfig } from "next-intl/server"

import { APP_TIME_ZONE } from "@/lib/i18n-locale"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = await resolveRequestLocale(
    typeof requested === "string" ? requested : undefined
  )

  return {
    locale,
    timeZone: APP_TIME_ZONE,
    now: new Date(),
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
