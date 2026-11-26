import type { AbstractIntlMessages } from "next-intl"

import { CLIENT_MESSAGES } from "@/lib/i18n-load-messages"
import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Server / SSR / Node source of the message catalogs used by `tMessage()` — every locale, EN base merged.
 *
 * Imported as `#i18n-catalog` (package.json "imports"). Browser bundles resolve that specifier to
 * `lib/i18n-catalog-source.browser.ts` instead, which reads the messages the page's `NextIntlClientProvider` already
 * received: the eight catalogs (~3 MB of JS) no longer ship to the browser.
 */
export function catalogMessages(locale: AppLocale): AbstractIntlMessages | undefined {
  return CLIENT_MESSAGES[locale]
}

/** No-op outside the browser: the server always has the full catalogs. */
export function registerBrowserCatalog(_locale: AppLocale, _messages: AbstractIntlMessages): void {}
