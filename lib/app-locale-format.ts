import type { AppLocale } from "@/lib/i18n-locale"

const BCP47_BY_LOCALE: Record<AppLocale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  nl: "nl-NL",
  pl: "pl-PL",
}

export function bcp47ForAppLocale(locale: AppLocale): string {
  return BCP47_BY_LOCALE[locale] ?? "en-GB"
}

export function formatMoneyFromCents(
  cents: number,
  locale: AppLocale,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  return new Intl.NumberFormat(bcp47ForAppLocale(locale), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(cents / 100)
}

export function formatCount(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(bcp47ForAppLocale(locale), { maximumFractionDigits: 0 }).format(value)
}
