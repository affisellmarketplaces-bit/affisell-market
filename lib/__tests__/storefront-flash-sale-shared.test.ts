import { describe, expect, it } from "vitest"

import {
  endsAtFromPresetHours,
  flashSaleFromSectionContent,
  formatFlashSaleCountdownParts,
  isFlashSaleActive,
  parseFlashSaleListingIds,
  pickFlashSaleProducts,
} from "@/lib/storefront-flash-sale-shared"

describe("storefront-flash-sale-shared", () => {
  it("parses listing ids with dedupe and cap", () => {
    expect(parseFlashSaleListingIds(["a", "b", "a"])).toEqual(["a", "b"])
    expect(parseFlashSaleListingIds("x,y, x")).toEqual(["x", "y"])
  })

  it("detects active flash sale from endsAt", () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isFlashSaleActive(future)).toBe(true)
    expect(isFlashSaleActive(past)).toBe(false)
  })

  it("builds config from section content", () => {
    const endsAt = endsAtFromPresetHours(24)
    const config = flashSaleFromSectionContent({
      endsAt,
      listingIds: ["ap_1", "ap_2"],
      eyebrow: "Flash",
      title: "48h only",
    })
    expect(config?.listingIds).toEqual(["ap_1", "ap_2"])
    expect(config?.title).toBe("48h only")
    expect(isFlashSaleActive(config?.endsAt)).toBe(true)
  })

  it("picks products in listing order", () => {
    const products = [
      { listingId: "b", name: "B" },
      { listingId: "a", name: "A" },
    ]
    expect(pickFlashSaleProducts(products, ["a", "b"])).toEqual([
      { listingId: "a", name: "A" },
      { listingId: "b", name: "B" },
    ])
  })

  it("formats countdown parts", () => {
    expect(formatFlashSaleCountdownParts(90_061_000)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
    })
  })
})
