import { defineRouting } from "next-intl/routing"

import { LOCALE_COOKIE, localeCookieMaxAgeSec } from "@/lib/i18n-locale"

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /** Must match `LanguageSwitcher` — next-intl defaults to `NEXT_LOCALE` otherwise. */
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: localeCookieMaxAgeSec(),
  },
})
