import { describe, expect, it } from "vitest"

import { STOREFRONT_TRUST_LEGAL_LINKS } from "@/lib/storefront-trust-shared"

describe("storefront trust shared", () => {
  it("exposes buyer legal links for storefront footer", () => {
    const hrefs = STOREFRONT_TRUST_LEGAL_LINKS.map((l) => l.href)
    expect(hrefs).toContain("/legal/cgv")
    expect(hrefs).toContain("/legal/confidentialite")
    expect(hrefs).toContain("/legal/mentions-legales")
    expect(hrefs).toContain("/legal/retractation")
  })
})
