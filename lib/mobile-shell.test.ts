import { describe, expect, it } from "vitest"

import { shouldHideMobileDock } from "@/lib/mobile-shell"

describe("shouldHideMobileDock", () => {
  it("hides on immersive buyer routes", () => {
    expect(shouldHideMobileDock("/discover")).toBe(true)
    expect(shouldHideMobileDock("/marketplace/abc123")).toBe(true)
    expect(shouldHideMobileDock("/shops/acme/product/widget")).toBe(true)
  })

  it("hides on affiliate shop storefronts", () => {
    expect(shouldHideMobileDock("/shops/acme")).toBe(true)
    expect(shouldHideMobileDock("/shops/acme/login")).toBe(true)
    expect(shouldHideMobileDock("/fr/shops/acme")).toBe(true)
  })

  it("shows on browse surfaces", () => {
    expect(shouldHideMobileDock("/")).toBe(false)
    expect(shouldHideMobileDock("/marketplace")).toBe(false)
    expect(shouldHideMobileDock("/cart")).toBe(false)
    expect(shouldHideMobileDock("/shops")).toBe(false)
    expect(shouldHideMobileDock("/shops/browse")).toBe(false)
  })

  it("hides on auth flows", () => {
    expect(shouldHideMobileDock("/login")).toBe(true)
    expect(shouldHideMobileDock("/signup/supplier")).toBe(true)
  })

  it("hides on checkout and success (transaction focus)", () => {
    expect(shouldHideMobileDock("/checkout/blind")).toBe(true)
    expect(shouldHideMobileDock("/success")).toBe(true)
    expect(shouldHideMobileDock("/cart")).toBe(false)
  })
})
