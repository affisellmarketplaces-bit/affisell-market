import { describe, expect, it } from "vitest"

import {
  affiliateListingPreviewHref,
  isAffiliateOwnerPreviewUrl,
  isAffiliateStoreOwner,
  shouldShowAffiliateStorePreviewBanner,
} from "@/lib/affiliate-store-preview-access"

describe("affiliate-store-preview-access", () => {
  it("matches store owner by user id only", () => {
    expect(isAffiliateStoreOwner("u1", "u1")).toBe(true)
    expect(isAffiliateStoreOwner("u1", "u2")).toBe(false)
    expect(isAffiliateStoreOwner(null, "u1")).toBe(false)
  })

  it("requires preview=affiliate in the URL", () => {
    expect(isAffiliateOwnerPreviewUrl(new URLSearchParams("preview=affiliate"))).toBe(true)
    expect(isAffiliateOwnerPreviewUrl(new URLSearchParams(""))).toBe(false)
  })

  it("shows banner only for owner in preview mode", () => {
    expect(shouldShowAffiliateStorePreviewBanner(true, true)).toBe(true)
    expect(shouldShowAffiliateStorePreviewBanner(false, true)).toBe(false)
    expect(shouldShowAffiliateStorePreviewBanner(true, false)).toBe(false)
  })

  it("builds shop PDP preview href for hidden listings", () => {
    expect(
      affiliateListingPreviewHref({
        storeSlug: "ecom-store",
        listingId: "listing_1",
        productId: "product_1",
      })
    ).toBe("/shops/ecom-store/product/listing_1?preview=affiliate")
  })
})
