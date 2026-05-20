import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /**
   * Do not auto-redirect `/` ↔ `/fr` from cookie + Accept-Language (causes redirect loops
   * with split `app/page.tsx` + `app/[locale]/page.tsx`). Locale is chosen via URL or switcher.
   */
  localeDetection: false,
  /** Cookie is managed in `middleware.ts` + `LanguageSwitcher` to avoid conflicting redirects. */
  localeCookie: false,
})
