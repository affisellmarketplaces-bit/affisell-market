import { describe, expect, it } from "vitest"

import {
  listingGalleryUrls,
  listingPrimaryImageUrl,
} from "@/lib/affiliate-listing-display"
import { primaryProductImage } from "@/lib/product-images"

describe("affiliate-listing-display image fallbacks", () => {
  it("falls back to product image when custom image is unusable", () => {
    expect(
      listingPrimaryImageUrl(
        ["blob:https://affisell.test/preview", "data:image/png;base64,abc"],
        ["https://cdn.example/product.jpg"]
      )
    ).toBe("https://cdn.example/product.jpg")
  })

  it("returns product gallery when custom gallery only contains unusable images", () => {
    expect(
      listingGalleryUrls(
        ["blob:https://affisell.test/preview", "data:image/png;base64,abc"],
        ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"]
      )
    ).toEqual(["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"])
  })

  it("keeps usable custom images ahead of product images", () => {
    expect(
      listingGalleryUrls(
        ["https://cdn.example/custom.jpg", "https://cdn.example/custom-2.jpg"],
        ["https://cdn.example/product.jpg"]
      )
    ).toEqual(["https://cdn.example/custom.jpg", "https://cdn.example/custom-2.jpg"])
  })

  it("skips unusable product gallery URLs in generic product pickers", () => {
    expect(
      primaryProductImage([
        "blob:https://affisell.test/preview",
        "data:image/png;base64,abc",
        "https://cdn.example/product.jpg",
      ])
    ).toBe("https://cdn.example/product.jpg")
  })
})
