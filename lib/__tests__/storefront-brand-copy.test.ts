import { describe, expect, it } from "vitest"

import { parseGeneratedBrandCopy } from "@/lib/storefront-brand-copy.server"

describe("parseGeneratedBrandCopy", () => {
  it("parses valid JSON copy", () => {
    const parsed = parseGeneratedBrandCopy(
      JSON.stringify({
        description: "Premium picks for your audience.",
        storyBody: "We curate quality products from trusted suppliers.",
        ctaTitle: "Shop now",
        ctaBody: "Discover the edit.",
      })
    )
    expect(parsed?.description).toContain("Premium")
    expect(parsed?.ctaTitle).toBe("Shop now")
  })

  it("rejects incomplete JSON", () => {
    expect(parseGeneratedBrandCopy(JSON.stringify({ description: "Only one field" }))).toBeNull()
  })
})
