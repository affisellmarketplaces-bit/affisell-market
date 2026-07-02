import type { BuyerListingCard } from "@/lib/buyer-discovery-types"
import {
  DELIVERY_WORLDWIDE,
  normalizeDeliveryCountryCode,
} from "@/lib/supplier-delivery-countries"

/** Higher = more relevant for visitor checkout country. */
export function scoreDeliveryCountryBoost(
  deliveryCountryCodes: readonly string[],
  visitorCountryIso2: string | null | undefined
): number {
  const visitor = normalizeDeliveryCountryCode(visitorCountryIso2 ?? "")
  if (!visitor || visitor === DELIVERY_WORLDWIDE) return 0

  const codes = deliveryCountryCodes
    .map((code) => normalizeDeliveryCountryCode(code))
    .filter((code): code is string => Boolean(code))

  if (codes.length === 0) return 10
  if (codes.includes(DELIVERY_WORLDWIDE)) return 20
  if (codes.includes(visitor)) return 30
  return 0
}

type ProductDeliveryRow = {
  product: { deliveryCountryCodes?: string[] | null }
}

/** Stable sort — keeps conversion order within the same boost tier. */
export function sortListingRowsByDeliveryCountryBoost<T extends ProductDeliveryRow>(
  rows: readonly T[],
  visitorCountryIso2: string | null | undefined
): T[] {
  const visitor = normalizeDeliveryCountryCode(visitorCountryIso2 ?? "")
  if (!visitor || visitor === DELIVERY_WORLDWIDE || rows.length <= 1) {
    return [...rows]
  }

  return [...rows]
    .map((row, index) => ({
      row,
      index,
      score: scoreDeliveryCountryBoost(row.product.deliveryCountryCodes ?? [], visitor),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ row }) => row)
}

export function sortBuyerListingCardsByDeliveryCountryBoost(
  items: readonly BuyerListingCard[],
  deliveryCodesByProductId: ReadonlyMap<string, readonly string[]>,
  visitorCountryIso2: string | null | undefined
): BuyerListingCard[] {
  const visitor = normalizeDeliveryCountryCode(visitorCountryIso2 ?? "")
  if (!visitor || visitor === DELIVERY_WORLDWIDE || items.length <= 1) {
    return [...items]
  }

  return [...items]
    .map((item, index) => ({
      item,
      index,
      score: scoreDeliveryCountryBoost(
        deliveryCodesByProductId.get(item.productId) ?? [],
        visitor
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}
