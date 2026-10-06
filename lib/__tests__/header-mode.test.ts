import { describe, expect, it } from "vitest"

import {
  nextHeaderMode,
  rebaseHeaderMode,
  visibleHeaderMode,
  type HeaderModeState,
} from "@/lib/storefront/header-mode"

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

describe("iOS rubber-banding and viewport changes", () => {
  const runMax = (positions: number[], maxY: number, from: HeaderModeState) => {
    let s = from
    return positions.map((y) => (s = nextHeaderMode(s, y, { maxY })).mode)
  }

  it("does not pop the header back when the page bounces at the very bottom", () => {
    // Reading down to the end (max 5000), bouncing out to 5040, elastic return to 5000: nothing here is an upward gesture.
    expect(runMax([4900, 5000, 5020, 5040, 5030, 5010, 5000], 5000, { mode: "full", lastY: 4800 })).toEqual([
      "hidden", "hidden", "hidden", "hidden", "hidden", "hidden", "hidden",
    ])
  })

  it("still reacts to a genuine upward scroll away from the bottom", () => {
    expect(runMax([5000, 5030, 4950], 5000, { mode: "hidden", lastY: 4990 })).toEqual(["hidden", "hidden", "bar"])
  })

  it("without a known maximum the behaviour is unchanged", () => {
    expect(run([5000, 5040, 5000], { mode: "hidden", lastY: 4990 })).toEqual(["hidden", "hidden", "bar"])
  })

  it("keeps the mode and only moves the reference point when the viewport (not the visitor) shifted the page", () => {
    const hidden: HeaderModeState = { mode: "hidden", lastY: 1200 }
    const rebased = rebaseHeaderMode(hidden, 1103) // toolbar collapse re-anchored the page 97px up
    expect(rebased).toEqual({ mode: "hidden", lastY: 1103 })
    // the next real gesture is measured from the new position: small drift is ignored, a real upward move is not
    expect(nextHeaderMode(rebased, 1100).mode).toBe("hidden")
    expect(nextHeaderMode(rebased, 1080).mode).toBe("bar")
  })

  it("never rebases to a negative offset", () => {
    expect(rebaseHeaderMode({ mode: "bar", lastY: 500 }, -40).lastY).toBe(0)
  })
})
