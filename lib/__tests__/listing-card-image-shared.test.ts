import { describe, expect, it } from "vitest"

import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"
import {
  isListingCardImageProxyUrl,
  listingCardImageCacheTag,
  listingCardImageProxyUrl,
  resolveBuyerCardImageHref,
  resolveListingCardImageHref,
} from "@/lib/listing-card-image-shared"

describe("listing card image proxy", () => {
  it("builds same-origin thumbnail route", () => {
    expect(listingCardImageProxyUrl("abc123")).toBe("/api/listing-card-image/abc123")
    expect(isListingCardImageProxyUrl("/api/listing-card-image/abc123")).toBe(true)
  })

  it("keeps remote https image when displayable", () => {
    expect(
      resolveListingCardImageHref("https://cdn.example/x.jpg", "listing-1")
    ).toBe("https://cdn.example/x.jpg")
  })

  it("falls back to proxy for base64-only listings", () => {
    expect(resolveListingCardImageHref(null, "listing-1")).toBe(
      "/api/listing-card-image/listing-1"
    )
    expect(resolveListingCardImageHref("data:image/png;base64,x", "listing-1")).toBe(
      "/api/listing-card-image/listing-1"
    )
  })

  it("uses placeholder when listing id missing", () => {
    expect(resolveListingCardImageHref(null, "")).toBe(PRODUCT_CARD_IMAGE_FALLBACK)
  })

  it("prefers remote https on buyer cards when displayable", () => {
    expect(resolveBuyerCardImageHref("https://cdn.example/x.jpg", "listing-1")).toBe(
      "https://cdn.example/x.jpg"
    )
  })

  it("falls back to proxy for base64-only buyer cards", () => {
    expect(resolveBuyerCardImageHref("data:image/png;base64,x", "listing-1")).toBe(
      "/api/listing-card-image/listing-1"
    )
  })

  it("keeps remote image on buyer cards without listing id", () => {
    expect(resolveBuyerCardImageHref("https://cdn.example/x.jpg", "")).toBe(
      "https://cdn.example/x.jpg"
    )
  })

  it("exposes unstable_cache tag helper", () => {
    expect(listingCardImageCacheTag("x")).toBe("listing-card-image:x")
  })
})
