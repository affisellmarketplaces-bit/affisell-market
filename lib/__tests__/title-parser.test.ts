import { describe, expect, it } from "vitest"

import { suggestFromTitle, titleSuggestionAttributes } from "@/lib/title-parser"

describe("suggestFromTitle", () => {
  it("detects smartphone category and Apple specs", () => {
    const s = suggestFromTitle("iPhone 15 Pro 256 Go Titane")
    expect(s.categorySlug).toBe("telephones-portables-deverrouilles")
    expect(s.brand).toBe("Apple")
    expect(s.storage_gb).toBe("256")
    expect(s.color).toBe("Titane")
    expect(s.operating_system).toBe("iOS")
  })

  it("detects sneakers category", () => {
    const s = suggestFromTitle("Nike Air Max 42 Noir")
    expect(s.categorySlug).toBe("chaussures")
    expect(s.brand).toBe("Nike")
    expect(s.eu_size).toBe("42")
  })

  it("titleSuggestionAttributes omits categorySlug", () => {
    const attrs = titleSuggestionAttributes(suggestFromTitle("Samsung Galaxy S24 128gb"))
    expect(attrs.categorySlug).toBeUndefined()
    expect(attrs.brand).toBe("Samsung")
    expect(attrs.storage_gb).toBe("128")
  })
})
