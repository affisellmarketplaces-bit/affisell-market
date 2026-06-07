import type { AppLocale } from "@/lib/i18n-locale"

/** Locales exposed in LanguageSwitcher once messages/{locale}.json passes i18n:parity. */
export const FULL_MESSAGE_BUNDLE_LOCALES = [
  "en",
  "fr",
  "de",
] as const satisfies readonly AppLocale[]

export function isFullMessageBundleLocale(locale: string): locale is AppLocale {
  return (FULL_MESSAGE_BUNDLE_LOCALES as readonly string[]).includes(locale)
}
