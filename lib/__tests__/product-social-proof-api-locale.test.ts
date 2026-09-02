import { describe, expect, it } from "vitest"

import { resolveProductSocialProofApiLocale } from "@/lib/product-social-proof-api-locale"

describe("resolveProductSocialProofApiLocale", () => {
  it("defaults to FR on EU market without cookie", () => {
    const req = new Request("http://localhost:3001/api/product-social-proof?productId=x", {
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    expect(resolveProductSocialProofApiLocale(req)).toBe("fr")
  })

  it("respects affisell_locale cookie", () => {
    const req = new Request("http://localhost:3001/api/product-social-proof?productId=x", {
      headers: { cookie: "affisell_locale=en" },
    })
    expect(resolveProductSocialProofApiLocale(req)).toBe("en")
  })

  it("respects locale query param", () => {
    const req = new Request("http://localhost:3001/api/product-social-proof?productId=x&locale=en")
    expect(resolveProductSocialProofApiLocale(req, "en")).toBe("en")
  })
})
