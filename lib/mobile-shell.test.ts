import { describe, expect, it } from "vitest"

import { shouldHideMobileDock } from "@/lib/mobile-shell"

describe("shouldHideMobileDock", () => {
  it("hides on immersive buyer routes", () => {
    expect(shouldHideMobileDock("/discover")).toBe(true)
    expect(shouldHideMobileDock("/marketplace/abc123")).toBe(true)
    expect(shouldHideMobileDock("/shops/acme/product/widget")).toBe(true)
  })

  it("shows on browse surfaces", () => {
    expect(shouldHideMobileDock("/")).toBe(false)
    expect(shouldHideMobileDock("/marketplace")).toBe(false)
    expect(shouldHideMobileDock("/cart")).toBe(false)
  })
})
