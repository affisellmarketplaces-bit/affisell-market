import {
  EU_MEMBER_ISO2,
  stripeCheckoutAllowedCountries,
} from "@/lib/eu-market-countries"
import type { AppLocale } from "@/lib/i18n-locale"
import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import { tMessage } from "@/lib/i18n-pick-message"
import { visitorCountryDisplayName } from "@/lib/visitor-country"

/** Sentinel stored in `deliveryCountryCodes` — delivers to all platform checkout countries. */
export const DELIVERY_WORLDWIDE = "WORLDWIDE"

export const DELIVERY_COUNTRIES_REQUIRED_ERROR = "delivery_countries_required"

export type DeliveryCountryPresetId = "fr" | "eu" | "eu_plus" | "worldwide"

const ISO2_RE = /^[A-Z]{2}$/

export function normalizeDeliveryCountryCode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase()
  if (trimmed === DELIVERY_WORLDWIDE) return DELIVERY_WORLDWIDE
  const code = trimmed.slice(0, 2)
  if (!ISO2_RE.test(code)) return null
  return code
}

/** Curated list for supplier picker (current market checkout universe). */
export function supplierDeliveryCountryOptions(): readonly string[] {
  return stripeCheckoutAllowedCountries()
}

export function deliveryCountryPresetCodes(
  preset: DeliveryCountryPresetId,
  originCountry?: string | null
): string[] {
  switch (preset) {
    case "fr":
      return ["FR"]
    case "eu":
      return [...EU_MEMBER_ISO2]
    case "eu_plus":
      return [...supplierDeliveryCountryOptions()]
    case "worldwide":
      return [DELIVERY_WORLDWIDE]
    default: {
      const origin = normalizeDeliveryCountryCode(originCountry ?? "")
      if (origin && origin !== DELIVERY_WORLDWIDE) return [origin]
      return ["FR"]
    }
  }
}

export function parseDeliveryCountryCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = new Set<string>()
  for (const item of raw) {
    if (typeof item !== "string") continue
    const code = normalizeDeliveryCountryCode(item)
    if (code) out.add(code)
  }
  if (out.has(DELIVERY_WORLDWIDE)) return [DELIVERY_WORLDWIDE]
  return [...out].sort()
}

export function validateDeliveryCountriesForPublish(codes: string[]): typeof DELIVERY_COUNTRIES_REQUIRED_ERROR | null {
  if (codes.length === 0) return DELIVERY_COUNTRIES_REQUIRED_ERROR
  return null
}

export function productDeliversToCountry(codes: string[], countryIso2: string): boolean {
  const destination = normalizeDeliveryCountryCode(countryIso2)
  if (!destination || destination === DELIVERY_WORLDWIDE) return false
  if (codes.length === 0) return true
  if (codes.includes(DELIVERY_WORLDWIDE)) return true
  return codes.includes(destination)
}

export function resolvedDeliveryCountriesForProduct(
  codes: string[],
  platformAllowed: readonly string[]
): string[] {
  const allowed = new Set(platformAllowed.map((c) => c.toUpperCase()))
  if (codes.length === 0) {
    return [...allowed].sort()
  }
  if (codes.includes(DELIVERY_WORLDWIDE)) {
    return [...allowed].sort()
  }
  return codes.filter((c) => allowed.has(c)).sort()
}

export function intersectProductDeliveryCountries(
  products: ReadonlyArray<{ deliveryCountryCodes: string[] }>,
  platformAllowed: readonly string[]
): string[] {
  if (products.length === 0) return [...platformAllowed].sort()

  let intersection: Set<string> | null = null
  for (const product of products) {
    const resolved = new Set(
      resolvedDeliveryCountriesForProduct(product.deliveryCountryCodes, platformAllowed)
    )
    if (intersection === null) {
      intersection = resolved
      continue
    }
    intersection = new Set([...intersection].filter((code) => resolved.has(code)))
  }

  return intersection ? [...intersection].sort() : []
}

export function formatDeliveryCountriesSummary(
  codes: string[],
  locale: AppLocale = "fr"
): string {
  if (codes.includes(DELIVERY_WORLDWIDE)) {
    return tMessage(locale, "Product.logistics.deliveryCountries.worldwide", "Worldwide")
  }
  if (codes.length === 0) {
    return tMessage(locale, "Product.logistics.deliveryCountries.notSpecified", "Not specified")
  }
  const intlTag = intlLocaleTag(locale)
  if (codes.length <= 3) {
    return codes
      .map((code) => visitorCountryDisplayName(code, intlTag))
      .join(locale === "fr" ? ", " : ", ")
  }
  const template = tMessage(
    locale,
    "Product.logistics.deliveryCountries.countryCount",
    "{count} countries"
  )
  return template.replace("{count}", String(codes.length))
}

export function suggestDeliveryCountriesFromWarehouse(args: {
  warehouseType: string | null | undefined
  shippingCountry?: string | null
}): string[] {
  const wt = (args.warehouseType ?? "").trim().toLowerCase()
  if (wt === "international") return [DELIVERY_WORLDWIDE]
  if (wt === "regional") return deliveryCountryPresetCodes("eu")
  const origin = normalizeDeliveryCountryCode(args.shippingCountry ?? "")
  if (origin && origin !== DELIVERY_WORLDWIDE) return [origin]
  return deliveryCountryPresetCodes("fr")
}
