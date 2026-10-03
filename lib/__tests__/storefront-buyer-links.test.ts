import { describe, expect, it } from "vitest"

import {
  buyerContinueShoppingHref,
  buyerExploreHref,
  buyerListingHref,
  buyerOrdersHref,
  buyerReviewHref,
  buyerSignInHref,
} from "@/lib/storefront-buyer-links"

describe("buyer-flow links", () => {
  it("keep every link on the reseller host", () => {
    expect(buyerListingHref("ap_1", true)).toBe("/product/ap_1")
    expect(buyerContinueShoppingHref(true)).toBe("/")
    expect(buyerExploreHref(true)).toBe("/")
    expect(buyerOrdersHref(true)).toBe("/track-order")
    expect(buyerSignInHref(true)).toBe("/login?callbackUrl=%2Ftrack-order")
  })

  it("keep the marketplace routes on the platform", () => {
    expect(buyerListingHref("ap_1", false)).toBe("/marketplace/ap_1")
    expect(buyerContinueShoppingHref(false)).toBe("/shops/browse")
    expect(buyerExploreHref(false)).toBe("/#explorer")
    expect(buyerOrdersHref(false)).toBe("/marketplace/account/orders")
    expect(buyerSignInHref(false)).toBe("/login/customer?callbackUrl=/marketplace/account/orders")
  })

  it("never links a store host to a path the middleware redirects to the platform", () => {
    for (const href of [
      buyerListingHref("x", true),
      buyerContinueShoppingHref(true),
      buyerExploreHref(true),
      buyerOrdersHref(true),
      buyerSignInHref(true),
      buyerReviewHref("ap_1", "ord_2", true),
    ]) {
      expect(href.startsWith("/marketplace")).toBe(false)
      expect(href.startsWith("/shops/browse")).toBe(false)
      expect(href.startsWith("/login/customer")).toBe(false)
    }
  })

  it("builds the review deep link for the right host and escapes ids", () => {
    expect(buyerReviewHref("ap_1", "ord_2", true)).toBe("/product/ap_1?writeReview=true&orderId=ord_2")
    expect(buyerReviewHref("ap_1", "ord_2", false)).toBe("/marketplace/ap_1?writeReview=true&orderId=ord_2")
    expect(buyerReviewHref("a/b", "o&r", true)).toBe("/product/a%2Fb?writeReview=true&orderId=o%26r")
  })
})
