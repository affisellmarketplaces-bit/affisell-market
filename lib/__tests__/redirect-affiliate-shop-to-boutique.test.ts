import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

import {
  redirectAffiliateShopHomeToBoutique,
  redirectAffiliateShopProductToBoutique,
} from "@/lib/boutique/redirect-affiliate-shop-to-boutique.server"

describe("redirect-affiliate-shop-to-boutique.server", () => {
  it("redirects shop home to boutique preserving query", () => {
    expect(() =>
      redirectAffiliateShopHomeToBoutique("ecom-store", { preview: "affiliate" })
    ).toThrow("REDIRECT:/boutique/ecom-store?preview=affiliate")
  })

  it("redirects shop PDP to boutique productId query", () => {
    expect(() =>
      redirectAffiliateShopProductToBoutique("ecom-store", "ap_123", { writeReview: "true" })
    ).toThrow("REDIRECT:/boutique/ecom-store?productId=ap_123&writeReview=true")
  })
})
