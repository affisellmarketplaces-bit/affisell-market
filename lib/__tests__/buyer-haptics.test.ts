import { describe, expect, it, vi } from "vitest"

import { buyerHaptic } from "@/lib/buyer-haptics"

describe("buyer-haptics", () => {
  it("no-ops when vibrate is unavailable", () => {
    expect(() => buyerHaptic("cartAdd")).not.toThrow()
  })

  it("calls navigator.vibrate when supported", () => {
    const vibrate = vi.fn()
    vi.stubGlobal("navigator", { vibrate })
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    })
    buyerHaptic("wishlistAdd")
    expect(vibrate).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("skips vibration when reduced motion is preferred", () => {
    const vibrate = vi.fn()
    vi.stubGlobal("navigator", { vibrate })
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    })
    buyerHaptic("cartAdd")
    expect(vibrate).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
