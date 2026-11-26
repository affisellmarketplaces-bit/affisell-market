import type { AbstractIntlMessages } from "next-intl"

import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Browser source of the catalogs used by `tMessage()` (see lib/i18n-catalog-source.ts).
 *
 * `IntlAppProvider` registers the messages of the page — the same `loadAppMessages(locale)` object the server used —
 * while rendering, before any child calls `tMessage()`. So the browser returns exactly what the server rendered, and
 * hydration matches, without bundling every catalog. A locale other than the page's has no catalog here:
 * `tMessage()` then returns its fallback.
 *
 * MUST NOT import `messages/*.json` or `lib/i18n-load-messages.ts` (lib/__tests__/client-bundle-catalogs.test.ts).
 */
let current: { locale: AppLocale; messages: AbstractIntlMessages } | null = null

export function registerBrowserCatalog(locale: AppLocale, messages: AbstractIntlMessages): void {
  if (current?.locale === locale && current.messages === messages) return
  current = { locale, messages }
}

export function catalogMessages(locale: AppLocale): AbstractIntlMessages | undefined {
  return current && current.locale === locale ? current.messages : undefined
}
