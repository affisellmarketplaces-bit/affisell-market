import { describe, expect, it } from "vitest"

import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"

describe("formatResellerStoreLabel", () => {
  it("title-cases slug segments", () => {
    expect(formatResellerStoreLabel("ma-premiere-boutique")).toBe("Ma Premiere Boutique")
  })
})
