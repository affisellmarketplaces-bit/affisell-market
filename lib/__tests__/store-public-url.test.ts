import { describe, expect, it } from "vitest"

import { storePublicUrl } from "@/lib/store-public-url"

describe("storePublicUrl", () => {
  it("uses verified custom domain", () => {
    expect(
      storePublicUrl({
        slug: "shop",
        customDomain: "boutique.fr",
        domainVerified: true,
        role: "AFFILIATE",
      })
    ).toBe("https://boutique.fr")
  })

  it("falls back to platform path when domain not verified", () => {
    const url = storePublicUrl({
      slug: "my-shop",
      customDomain: "boutique.fr",
      domainVerified: false,
      role: "AFFILIATE",
    })
    expect(url).toContain("/shops/my-shop")
  })
})
