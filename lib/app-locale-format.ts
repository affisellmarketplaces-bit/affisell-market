import type { AppLocale } from "@/lib/i18n-locale"

export function bcp47ForAppLocale(locale: AppLocale): string {
  return locale === "fr" ? "fr-FR" : "en-GB"
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
