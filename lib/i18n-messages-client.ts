import type { AbstractIntlMessages } from "next-intl"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  resolveAppLocale,
  type AppLocale,
} from "@/lib/i18n-locale"
import { CLIENT_MESSAGES, loadAppMessages } from "@/lib/i18n-load-messages"

export { CLIENT_MESSAGES }

export function readLocaleFromDocumentCookie(): AppLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE
  const pattern = SUPPORTED_LOCALES.join("|")
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=(${pattern})`))
  return resolveAppLocale(match?.[1])
}

export function messagesForLocale(locale: AppLocale): AbstractIntlMessages {
  return loadAppMessages(locale)
}
