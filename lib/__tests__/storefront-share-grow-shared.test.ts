import { describe, expect, it } from "vitest"

import {
  buildStorefrontFacebookShareUrl,
  buildStorefrontTwitterShareUrl,
  buildStorefrontWhatsAppShareUrl,
} from "@/lib/storefront-share-grow-shared"

describe("storefront-share-grow-shared", () => {
  it("builds encoded share URLs", () => {
    const url = "https://demo.shops.affisell.com"
    const msg = "Shop my picks"
    expect(buildStorefrontWhatsAppShareUrl(url, msg)).toContain("wa.me")
    expect(buildStorefrontWhatsAppShareUrl(url, msg)).toContain(encodeURIComponent(url))
    expect(buildStorefrontTwitterShareUrl(url, msg)).toContain("twitter.com/intent/tweet")
    expect(buildStorefrontFacebookShareUrl(url)).toContain("facebook.com/sharer")
  })
})
