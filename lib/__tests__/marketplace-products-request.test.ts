import { describe, expect, it } from "vitest"

import { resolveMarketplaceProductsFetchOptions } from "@/lib/marketplace-products-request"

describe("resolveMarketplaceProductsFetchOptions", () => {
  it("uses lite payload for text search", () => {
    const opts = resolveMarketplaceProductsFetchOptions(new URLSearchParams("q=robe"))
    expect(opts.lite).toBe(true)
    expect(opts.take).toBe(48)
    expect(opts.hasFilters).toBe(true)
  })

  it("uses home take for lite browse without query", () => {
    const opts = resolveMarketplaceProductsFetchOptions(new URLSearchParams("lite=1"))
    expect(opts.lite).toBe(true)
    expect(opts.take).toBe(24)
    expect(opts.hasFilters).toBe(false)
  })

  it("uses full catalog payload by default", () => {
    const opts = resolveMarketplaceProductsFetchOptions(new URLSearchParams())
    expect(opts.lite).toBe(false)
    expect(opts.take).toBe(120)
  })
})
