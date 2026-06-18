import { describe, expect, it } from "vitest"

import { catalogFilterHref, catalogFilterHrefFromParams } from "@/lib/marketplace-catalog-nav.client"

describe("marketplace-catalog-nav", () => {
  it("builds in-app filter URLs without #explorer hash", () => {
    expect(catalogFilterHref("/")).toBe("/")
    expect(catalogFilterHref("/", "offer=refurbished")).toBe("/?offer=refurbished")
    expect(catalogFilterHref("/shops/browse", "q=tv")).toBe("/shops/browse?q=tv")
  })

  it("builds from URLSearchParams", () => {
    const sp = new URLSearchParams({ category: "abc", offer: "new" })
    expect(catalogFilterHrefFromParams("/", sp)).toBe("/?category=abc&offer=new")
  })
})
