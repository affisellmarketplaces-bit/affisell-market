import { describe, expect, it } from "vitest"

import {
  isDisplayableListingImageUrl,
  pickListingCardImageUrl,
  PRODUCT_CARD_IMAGE_FALLBACK,
} from "@/lib/affiliate-listing-display"

describe("listing card image", () => {
  it("skips data: custom previews and uses product gallery", () => {
    expect(
      pickListingCardImageUrl(
        ["data:image/png;base64,abc"],
        ["https://cdn.example/ok.jpg"]
      )
    ).toBe("https://cdn.example/ok.jpg")
  })

  it("prefers first displayable custom image", () => {
    expect(
      pickListingCardImageUrl(
        ["blob:http://localhost/x", "https://cdn.example/custom.jpg"],
        ["https://cdn.example/product.jpg"]
      )
    ).toBe("https://cdn.example/custom.jpg")
  })

  it("returns null when gallery has no displayable urls", () => {
    expect(
      pickListingCardImageUrl(["data:image/png;base64,x"], ["blob:local"])
    ).toBeNull()
  })

  it("validates http(s) and same-origin paths", () => {
    expect(isDisplayableListingImageUrl("https://a/b.jpg")).toBe(true)
    expect(isDisplayableListingImageUrl("/placeholder.png")).toBe(true)
    expect(isDisplayableListingImageUrl("data:image/png;base64,x")).toBe(false)
    expect(isDisplayableListingImageUrl("blob:http://x")).toBe(false)
  })

  it("uses lightweight fallback constant", () => {
    expect(PRODUCT_CARD_IMAGE_FALLBACK).toBe("/placeholder.png")
  })
})
