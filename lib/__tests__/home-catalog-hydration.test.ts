import { describe, expect, it } from "vitest"

import { isCatalogLoading, shouldRevalidateCatalogOnMount } from "@/lib/home-catalog-hydration"

describe("home catalog hydration", () => {
  it("keeps trusting a non-empty server list, refetches an empty one", () => {
    expect(shouldRevalidateCatalogOnMount({ useInitialFallback: true, initialProductCount: 24 })).toBe(false)
    expect(shouldRevalidateCatalogOnMount({ useInitialFallback: true, initialProductCount: 0 })).toBe(true)
    expect(shouldRevalidateCatalogOnMount({ useInitialFallback: false, initialProductCount: 0 })).toBe(true)
  })

  it("shows the skeleton while an empty server list is re-checked, never before it has finished", () => {
    const base = { productCount: 0, isLoading: false, isValidating: true, initialListWasEmpty: true }
    expect(isCatalogLoading(base)).toBe(true)
    expect(isCatalogLoading({ ...base, isValidating: false })).toBe(false) // truly empty or errored → real message
    expect(isCatalogLoading({ ...base, productCount: 12 })).toBe(false)
    expect(isCatalogLoading({ ...base, initialListWasEmpty: false, isLoading: true })).toBe(true)
    expect(isCatalogLoading({ ...base, initialListWasEmpty: false })).toBe(false)
  })
})
