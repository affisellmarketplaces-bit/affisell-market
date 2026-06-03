import type { AppLocale } from "@/lib/i18n-locale"

export const AFFISELL_LOCALE_CHANGE_EVENT = "affisell:locale-change"

export type AffisellLocaleChangeDetail = { locale: AppLocale }

export function dispatchAffisellLocaleChange(locale: AppLocale): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<AffisellLocaleChangeDetail>(AFFISELL_LOCALE_CHANGE_EVENT, {
      detail: { locale },
    })
  )
}
