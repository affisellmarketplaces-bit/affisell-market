import type { AbstractIntlMessages } from "next-intl"

import type { AppLocale } from "@/lib/i18n-locale"
import { readLocaleFromDocumentCookie } from "@/lib/i18n-read-locale-cookie"
import { CLIENT_MESSAGES, loadAppMessages } from "@/lib/i18n-load-messages"

export { CLIENT_MESSAGES }
export { readLocaleFromDocumentCookie }

export function messagesForLocale(locale: AppLocale): AbstractIntlMessages {
  return loadAppMessages(locale)
}
