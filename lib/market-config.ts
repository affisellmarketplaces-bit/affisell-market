/**
 * EU-first storefront defaults. Override with `NEXT_PUBLIC_*` when you add a US (or other) site.
 *
 * - `NEXT_PUBLIC_MARKET_REGION` — `eu` (default) or `us`
 * - `NEXT_PUBLIC_STOREFRONT_LOCALE` — BCP 47 for `Intl` (default: `en-IE` for EU, `en-US` for US)
 * - `NEXT_PUBLIC_STOREFRONT_CURRENCY` — ISO 4217 (default: EUR for EU, USD for US)
 */

export type MarketRegion = "eu" | "us"

function readMarketRegion(): MarketRegion {
  const r = (process.env.NEXT_PUBLIC_MARKET_REGION ?? "eu").toLowerCase()
  return r === "us" ? "us" : "eu"
}

export const MARKET_REGION: MarketRegion = readMarketRegion()

function defaultLocaleForRegion(): string {
  return MARKET_REGION === "us" ? "en-US" : "en-IE"
}

/** BCP 47 tag for `Intl` number/currency/date formatting. */
export const STOREFRONT_LOCALE =
  process.env.NEXT_PUBLIC_STOREFRONT_LOCALE?.trim() || defaultLocaleForRegion()

function defaultCurrencyForRegion(): "EUR" | "USD" {
  return MARKET_REGION === "us" ? "USD" : "EUR"
}

const rawCurrency = (process.env.NEXT_PUBLIC_STOREFRONT_CURRENCY ?? defaultCurrencyForRegion()).toUpperCase()
export const STOREFRONT_CURRENCY: "EUR" | "USD" = rawCurrency === "USD" ? "USD" : "EUR"

/** Use on `<html lang={…}>` (e.g. `en-IE`, `fr-FR`). */
export const STOREFRONT_HTML_LANG = STOREFRONT_LOCALE

export function formatStoreCurrency(
  amount: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  return amount.toLocaleString(STOREFRONT_LOCALE, {
    style: "currency",
    currency: STOREFRONT_CURRENCY,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  })
}

export function formatStoreCurrencyFromCents(
  cents: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  return formatStoreCurrency(cents / 100, options)
}

export function formatStoreCount(value: number): string {
  return value.toLocaleString(STOREFRONT_LOCALE, { maximumFractionDigits: 0 })
}

export function formatStoreDateTime(
  d: Date | number | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d
  return date.toLocaleString(STOREFRONT_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  })
}

export function formatStoreDate(
  d: Date | number | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d
  return date.toLocaleDateString(STOREFRONT_LOCALE, {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  })
}
