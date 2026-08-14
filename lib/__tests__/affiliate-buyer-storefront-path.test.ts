import { describe, expect, it } from "vitest"

import {
  affiliateBuyerStorefrontHomePath,
  affiliateBuyerStorefrontProductPath,
  resolveAffiliateShopToBoutiqueRedirect,
} from "@/lib/boutique/affiliate-buyer-storefront-path"

describe("affiliate-buyer-storefront-path", () => {
  it("builds boutique home and product paths", () => {
    expect(affiliateBuyerStorefrontHomePath("ecom-store")).toBe("/boutique/ecom-store")
    expect(affiliateBuyerStorefrontProductPath("ecom-store", "listing_1")).toBe(
      "/boutique/ecom-store?productId=listing_1"
    )
  })

  it("redirects legacy shop home and PDP to boutique", () => {
    expect(resolveAffiliateShopToBoutiqueRedirect("/shops/ecom-store")).toBe("/boutique/ecom-store")
    expect(resolveAffiliateShopToBoutiqueRedirect("/shops/ecom-store/product/ap_123")).toBe(
      "/boutique/ecom-store?productId=ap_123"
    )
  })

  it("keeps browse, auth, and static pages on /shops", () => {
    expect(resolveAffiliateShopToBoutiqueRedirect("/shops/browse")).toBeNull()
    expect(resolveAffiliateShopToBoutiqueRedirect("/shops/ecom-store/login")).toBeNull()
    expect(resolveAffiliateShopToBoutiqueRedirect("/shops/ecom-store/about")).toBeNull()
  })
})
