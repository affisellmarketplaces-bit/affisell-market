import { defineRouting } from "next-intl/routing"

import { SUPPORTED_LOCALES } from "@/lib/i18n-locale"

export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /**
   * Do not auto-redirect `/` ↔ `/fr` / `/de` … from Accept-Language (redirect loops with
   * split `app/page.tsx` + `app/[locale]/page.tsx`). Locale is chosen via URL or switcher.
   */
  localeDetection: false,
  /** Cookie is managed in `middleware.ts` + `LanguageSwitcher` to avoid conflicting redirects. */
  localeCookie: false,
})
