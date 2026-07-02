import { describe, expect, it } from "vitest"

import {
  scoreDeliveryCountryBoost,
  sortBuyerListingCardsByDeliveryCountryBoost,
} from "@/lib/buyer-listing-country-boost"
import type { BuyerListingCard } from "@/lib/buyer-discovery-types"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"

function card(productId: string): BuyerListingCard {
  return {
    listingId: `listing-${productId}`,
    productId,
    name: productId,
    imageUrl: null,
    priceCents: 1000,
    compareAtCents: null,
    soldCount: 0,
    marginCents: 0,
    deliveryMin: 2,
    deliveryMax: 7,
    stock: 5,
    freeShipping: false,
    commissionPct: 0,
    averageRating: 4,
    reviewCount: 1,
    storeName: "Store",
    storeSlug: "store",
    nicheLabel: "lifestyle",
    categories: [],
    isBestSeller: false,
  }
}

describe("scoreDeliveryCountryBoost", () => {
  it("returns zero without visitor country", () => {
    expect(scoreDeliveryCountryBoost(["FR"], null)).toBe(0)
  })

  it("prioritizes explicit country match over worldwide and legacy", () => {
    expect(scoreDeliveryCountryBoost(["FR", "DE"], "FR")).toBe(30)
    expect(scoreDeliveryCountryBoost([DELIVERY_WORLDWIDE], "FR")).toBe(20)
    expect(scoreDeliveryCountryBoost([], "FR")).toBe(10)
    expect(scoreDeliveryCountryBoost(["US"], "FR")).toBe(0)
  })
})

describe("sortBuyerListingCardsByDeliveryCountryBoost", () => {
  it("promotes shippable listings while preserving order within tier", () => {
    const items = [card("legacy"), card("us-only"), card("fr-match")]
    const codes = new Map<string, string[]>([
      ["legacy", []],
      ["us-only", ["US"]],
      ["fr-match", ["FR", "DE"]],
    ])

    const sorted = sortBuyerListingCardsByDeliveryCountryBoost(items, codes, "FR")
    expect(sorted.map((item) => item.productId)).toEqual(["fr-match", "legacy", "us-only"])
  })
})
