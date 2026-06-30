import type { AppLocale } from "@/lib/i18n-locale"
import { shippingCountryLabel } from "@/lib/product-shipping-display"
import { formatDeliveryCountriesSummary } from "@/lib/supplier-delivery-countries"

export type ListingLogisticsInput = {
  shippingCountryCode: string | null
  shippingCountryLabel: string
  warehouseType: string | null
  warehouseCity: string | null
  shipsFromDisplay: string | null
  deliveryMin: number
  deliveryMax: number
  deliveryCountriesSummary: string
}

export type WarehouseZoneKey = "local" | "regional" | "international"

export function warehouseZoneKey(
  warehouseType: string | null | undefined
): WarehouseZoneKey | null {
  const wt = (warehouseType ?? "").trim().toLowerCase()
  if (wt === "local") return "local"
  if (wt === "regional") return "regional"
  if (wt === "international") return "international"
  return null
}

/** Primary "ships from" line — supplier text, city, or country label. */
export function listingShipsFromLabel(
  input: Pick<ListingLogisticsInput, "shipsFromDisplay" | "shippingCountryLabel" | "warehouseCity">
): string {
  const custom = input.shipsFromDisplay?.trim()
  if (custom) return custom
  const city = input.warehouseCity?.trim()
  if (city) return city
  return input.shippingCountryLabel
}

export function deliveryRangeLabel(min: number, max: number, locale: AppLocale): string {
  const isEn = locale === "en"
  if (min === max) {
    return isEn
      ? `${min} business day${min === 1 ? "" : "s"}`
      : `${min} jour${min === 1 ? "" : "s"} ouvré${min === 1 ? "" : "s"}`
  }
  return isEn ? `${min}–${max} business days` : `${min}–${max} jours ouvrés`
}

export function buildListingLogisticsInput(input: {
  shippingCountry: string | null | undefined
  warehouseType: string | null | undefined
  warehouseCity: string | null | undefined
  shipsFrom: string | null | undefined
  deliveryMin: number | null | undefined
  deliveryMax: number | null | undefined
  deliveryCountryCodes?: string[] | null
  locale?: AppLocale
}): ListingLogisticsInput {
  const code =
    typeof input.shippingCountry === "string" && input.shippingCountry.trim()
      ? input.shippingCountry.trim().toUpperCase().slice(0, 2)
      : null
  const locale = input.locale ?? "fr"
  const deliveryCodes = Array.isArray(input.deliveryCountryCodes) ? input.deliveryCountryCodes : []

  return {
    shippingCountryCode: code,
    shippingCountryLabel: shippingCountryLabel(code),
    warehouseType: input.warehouseType ?? null,
    warehouseCity: input.warehouseCity ?? null,
    shipsFromDisplay: input.shipsFrom ?? null,
    deliveryMin: input.deliveryMin ?? 2,
    deliveryMax: input.deliveryMax ?? 5,
    deliveryCountriesSummary: formatDeliveryCountriesSummary(deliveryCodes, locale),
  }
}
