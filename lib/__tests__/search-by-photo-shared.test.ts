import { describe, expect, it } from "vitest"

import { isAllowedSearchByPhotoDataUrl, sanitizeSearchByPhotoQuery } from "@/lib/search-by-photo-shared"

describe("sanitizeSearchByPhotoQuery", () => {
  it("trims a good query", () => {
    expect(sanitizeSearchByPhotoQuery("  blue ceramic coffee mug  ")).toBe("blue ceramic coffee mug")
  })

  it("rejects non-string input instead of throwing", () => {
    expect(sanitizeSearchByPhotoQuery(null)).toBe("")
    expect(sanitizeSearchByPhotoQuery(undefined)).toBe("")
    expect(sanitizeSearchByPhotoQuery(42)).toBe("")
    expect(sanitizeSearchByPhotoQuery({ query: "x" })).toBe("")
  })

  it("caps an unreasonably long response", () => {
    const long = "a".repeat(500)
    expect(sanitizeSearchByPhotoQuery(long).length).toBe(120)
  })

  it("an all-whitespace response sanitizes to empty (caller treats as no_match)", () => {
    expect(sanitizeSearchByPhotoQuery("   ")).toBe("")
  })
})

describe("isAllowedSearchByPhotoDataUrl", () => {
  it("accepts jpeg/png/webp data URLs", () => {
    expect(isAllowedSearchByPhotoDataUrl("data:image/jpeg;base64,AAAA")).toBe(true)
    expect(isAllowedSearchByPhotoDataUrl("data:image/png;base64,AAAA")).toBe(true)
    expect(isAllowedSearchByPhotoDataUrl("data:image/webp;base64,AAAA")).toBe(true)
  })

  it("rejects non-image data URLs and plain URLs", () => {
    expect(isAllowedSearchByPhotoDataUrl("data:text/html;base64,AAAA")).toBe(false)
    expect(isAllowedSearchByPhotoDataUrl("https://example.com/x.jpg")).toBe(false)
    expect(isAllowedSearchByPhotoDataUrl("")).toBe(false)
  })

  it("rejects an oversized payload (SSRF/DoS guard)", () => {
    const huge = `data:image/jpeg;base64,${"A".repeat(1_500_000)}`
    expect(isAllowedSearchByPhotoDataUrl(huge)).toBe(false)
  })
})
