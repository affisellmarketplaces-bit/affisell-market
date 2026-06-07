export const LOCALE_COOKIE = "affisell_locale"
export const APP_TIME_ZONE = "Europe/Paris"
export const SUPPORTED_LOCALES = ["en", "fr", "de", "es", "it", "nl", "pl", "zh"] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = "en"

export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

export function resolveAppLocale(raw: string | null | undefined): AppLocale {
  const v = raw?.trim().toLowerCase()
  return v && isAppLocale(v) ? v : DEFAULT_LOCALE
}

export function localeCookieMaxAgeSec(): number {
  return 60 * 60 * 24 * 365
}
