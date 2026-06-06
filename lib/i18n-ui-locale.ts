import type { AppLocale } from "@/lib/i18n-locale"

/** Full message bundles — no partial EN/FR mixing in the switcher. */
export const FULLY_TRANSLATED_LOCALES = ["en", "fr"] as const
export type FullyTranslatedLocale = (typeof FULLY_TRANSLATED_LOCALES)[number]

export const LOCALE_SWITCHER_OPTIONS = FULLY_TRANSLATED_LOCALES

export function isFullyTranslatedLocale(value: string): value is FullyTranslatedLocale {
  return FULLY_TRANSLATED_LOCALES.includes(value as FullyTranslatedLocale)
}

/** Legacy inline FR/EN maps — DE+ must fall back to EN, never French. */
export function resolveBinaryCopyLocale(locale: string): "en" | "fr" {
  return locale === "fr" ? "fr" : "en"
}

export function intlLocaleTag(locale: AppLocale): string {
  const tags: Record<AppLocale, string> = {
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    it: "it-IT",
    nl: "nl-NL",
    pl: "pl-PL",
  }
  return tags[locale] ?? "en-GB"
}
