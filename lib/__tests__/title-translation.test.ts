import { describe, expect, it } from "vitest"

import { factTokens, isFaithful, titleCacheKey } from "@/lib/title-translation.server"

describe("title translation guards", () => {
  it("extracts digit-bearing tokens", () => {
    expect(factTokens("Casque Pro X200 noir 45mm")).toEqual(["x200", "45mm"])
  })
  it("rejects a translation that drops a model/size", () => {
    expect(isFaithful("Wireless Headphones X200 45mm", "Kabellose Kopfhörer X200")).toBe(false)
    expect(isFaithful("Wireless Headphones X200 45mm", "Kabellose Kopfhörer X200 45mm")).toBe(true)
  })
  it("keys per locale and ignores whitespace", () => {
    expect(titleCacheKey("a  b", "fr")).toBe(titleCacheKey("a b", "fr"))
    expect(titleCacheKey("a b", "fr")).not.toBe(titleCacheKey("a b", "de"))
  })
})
