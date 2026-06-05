import {
  DEFAULT_PRODUCT_OFFER_MODE,
  minCatalogPriceCents,
  normalizeMinOrderQuantity,
  offerModeFromLegacyFlags,
  parseProductOfferMode,
  syncIsRefurbished,
  type ProductOfferMode,
} from "@/lib/product-offer-mode"

export type ParsedProductOffer = {
  offerMode: ProductOfferMode
  minOrderQuantity: number
  isRefurbished: boolean
}

export function parseProductOfferBody(
  body: Record<string, unknown>,
  fallback?: { offerMode?: string | null; isRefurbished?: boolean | null; minOrderQuantity?: number | null }
): ParsedProductOffer {
  const baseMode =
    fallback?.offerMode != null
      ? parseProductOfferMode(fallback.offerMode, DEFAULT_PRODUCT_OFFER_MODE)
      : offerModeFromLegacyFlags(fallback?.isRefurbished)

  const offerMode =
    "offerMode" in body
      ? parseProductOfferMode(body.offerMode, baseMode)
      : baseMode

  const moqRaw = body.minOrderQuantity ?? body.moq ?? fallback?.minOrderQuantity
  const minOrderQuantity = normalizeMinOrderQuantity(offerMode, moqRaw)

  return {
    offerMode,
    minOrderQuantity,
    isRefurbished: syncIsRefurbished(offerMode),
  }
}

export function resolveSupplierCatalogPriceCents(
  offerMode: ProductOfferMode,
  cents: number,
  isDraft: boolean
): number {
  const floor = minCatalogPriceCents(offerMode)
  if (!Number.isFinite(cents)) return isDraft ? floor : Math.max(floor, 100)
  const rounded = Math.round(cents)
  if (offerMode === "DONATION") return Math.max(0, rounded)
  if (isDraft && rounded <= 0) return floor
  return Math.max(floor, rounded || floor)
}
