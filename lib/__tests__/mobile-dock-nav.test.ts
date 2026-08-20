import { describe, expect, it } from "vitest"

import { shouldHardFallbackNav } from "@/lib/mobile-dock-nav"

describe("shouldHardFallbackNav", () => {
  it("returns false when already on target", () => {
    expect(shouldHardFallbackNav("/shops", "/shops")).toBe(false)
  })

  it("returns false for nested target path", () => {
    expect(shouldHardFallbackNav("/shops", "/shops/browse")).toBe(false)
  })

  it("returns true when navigation stalled on another route", () => {
    expect(shouldHardFallbackNav("/cart", "/")).toBe(true)
  })
})
