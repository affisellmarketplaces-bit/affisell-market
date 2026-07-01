import { describe, expect, it, vi } from "vitest"

import { pulseSwipeHaptic } from "@/lib/pulse-swipe-haptics"

describe("pulse-swipe-haptics", () => {
  it("no-ops when vibrate is unavailable", () => {
    expect(() => pulseSwipeHaptic("tap")).not.toThrow()
  })

  it("calls navigator.vibrate when supported", () => {
    const vibrate = vi.fn()
    vi.stubGlobal("navigator", { vibrate })
    pulseSwipeHaptic("commit")
    expect(vibrate).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
