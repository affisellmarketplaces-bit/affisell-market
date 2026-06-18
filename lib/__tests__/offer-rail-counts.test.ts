import { describe, expect, it } from "vitest"

import { offerFacetSlug } from "@/lib/product-offer-mode"

describe("offer rail counts API shape", () => {
  it("maps every offer mode to a URL slug", () => {
    expect(offerFacetSlug("STANDARD")).toBe("new")
    expect(offerFacetSlug("REFURBISHED")).toBe("refurbished")
    expect(offerFacetSlug("SECOND_HAND")).toBe("second_hand")
    expect(offerFacetSlug("WHOLESALE_ONLY")).toBe("wholesale")
    expect(offerFacetSlug("DONATION")).toBe("donation")
  })
})
