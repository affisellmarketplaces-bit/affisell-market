import { describe, expect, it } from "vitest"

import {
  resolveLockedSwipeAxis,
  resolveSwipeDirection,
} from "@/lib/pulse-swipe-gesture"

describe("pulse swipe gesture", () => {
  it("locks horizontal axis on clear horizontal drag", () => {
    expect(resolveLockedSwipeAxis({ x: 24, y: 4 }, null)).toBe("x")
    expect(resolveLockedSwipeAxis({ x: 4, y: 24 }, null)).toBe("y")
  })

  it("does not lock on ambiguous diagonal", () => {
    expect(resolveLockedSwipeAxis({ x: 20, y: 18 }, null)).toBeNull()
  })

  it("resolves right swipe when axis locked horizontal", () => {
    expect(
      resolveSwipeDirection({ x: 90, y: 8 }, { x: 0, y: 0 }, "x")
    ).toBe("right")
  })

  it("does not treat shallow vertical as horizontal skip", () => {
    expect(
      resolveSwipeDirection({ x: 72, y: 64 }, { x: 0, y: 0 }, null)
    ).toBeNull()
  })

  it("resolves up swipe on vertical axis", () => {
    expect(
      resolveSwipeDirection({ x: 6, y: -96 }, { x: 0, y: -500 }, "y")
    ).toBe("up")
  })
})
