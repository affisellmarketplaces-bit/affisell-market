import { defineRouting } from "next-intl/routing"

import { LOCALE_COOKIE, localeCookieMaxAgeSec } from "@/lib/i18n-locale"

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /**
   * Do not auto-redirect `/` ↔ `/fr` from cookie + Accept-Language (causes redirect loops
   * with split `app/page.tsx` + `app/[locale]/page.tsx`). Locale is chosen via URL or switcher.
   */
  localeDetection: false,
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: localeCookieMaxAgeSec(),
  },
})
