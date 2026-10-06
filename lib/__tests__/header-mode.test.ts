import { describe, expect, it } from "vitest"

import { nextHeaderMode, visibleHeaderMode, type HeaderModeState } from "@/lib/storefront/header-mode"

const START: HeaderModeState = { mode: "full", lastY: 0 }
const run = (positions: number[], from: HeaderModeState = START) => {
  let s = from
  return positions.map((y) => (s = nextHeaderMode(s, y)).mode)
}

describe("nextHeaderMode", () => {
  it("is complete near the top of the page, whatever happened before", () => {
    expect(run([0, 40, 119])).toEqual(["full", "full", "full"])
    expect(run([5], { mode: "hidden", lastY: 900 })).toEqual(["full"])
    expect(run([-30, -1], { mode: "bar", lastY: 400 })).toEqual(["full", "full"]) // iOS rubber-band
  })

  it("hides while reading down, and comes back as a compact bar on the first real upward scroll", () => {
    expect(run([200, 320, 480])).toEqual(["hidden", "hidden", "hidden"])
    expect(run([200, 480, 450])).toEqual(["hidden", "hidden", "bar"])
  })

  it("stays a bar while scrolling up, hides again on the next read-down", () => {
    expect(run([800, 700, 600, 590, 700])).toEqual(["hidden", "bar", "bar", "bar", "hidden"])
  })

  it("ignores jitter under the threshold in both directions", () => {
    expect(run([300, 304, 299, 303], { mode: "bar", lastY: 300 })).toEqual(["bar", "bar", "bar", "bar"])
    expect(run([300, 296, 301], { mode: "hidden", lastY: 300 })).toEqual(["hidden", "hidden", "hidden"])
  })

  it("returning to the top zone restores the complete header (rail included)", () => {
    expect(run([600, 500, 400, 300, 100])).toEqual(["hidden", "bar", "bar", "bar", "full"])
  })

  it("does not mutate the previous state", () => {
    const s: HeaderModeState = { mode: "full", lastY: 100 }
    nextHeaderMode(s, 900)
    expect(s).toEqual({ mode: "full", lastY: 100 })
  })
})

describe("visibleHeaderMode", () => {
  it("a header in use is never hidden", () => {
    expect(visibleHeaderMode("hidden", true)).toBe("bar")
    expect(visibleHeaderMode("hidden", false)).toBe("hidden")
    expect(visibleHeaderMode("full", true)).toBe("full")
    expect(visibleHeaderMode("bar", true)).toBe("bar")
  })
})
