import { describe, expect, it } from "vitest"

import { STOREFRONT_TRUST_LEGAL_LINKS } from "@/lib/storefront-trust-shared"

describe("storefront trust shared", () => {
  it("exposes buyer legal links for storefront footer", () => {
    const hrefs = STOREFRONT_TRUST_LEGAL_LINKS.map((l) => l.href)
    expect(hrefs).toContain("/legal/terms-of-sale")
    expect(hrefs).toContain("/legal/privacy-policy")
    expect(hrefs).toContain("/legal/legal-notice")
    expect(hrefs).toContain("/protected-checkout")
  })
})
