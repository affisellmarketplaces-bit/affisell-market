import type { AppLocale } from "@/lib/i18n-locale"
import { DEFAULT_LOCALE } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"
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
  if (min === max) {
    const key =
      min === 1 ? "Product.logistics.deliveryRangeSingleOne" : "Product.logistics.deliveryRangeSingleMany"
    return tMessage(locale, key).replace("{count}", String(min))
  }
  return tMessage(locale, "Product.logistics.deliveryRange")
    .replace("{min}", String(min))
    .replace("{max}", String(max))
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
  const locale = input.locale ?? DEFAULT_LOCALE
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
