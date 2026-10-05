import { describe, expect, it } from "vitest"

import {
  computeAnchoredPanelPosition,
  PANEL_MAX_WIDTH_PX,
  rightAlignedPanelLeft,
} from "@/lib/anchored-panel-position"

/** Left and right edge of the panel in viewport coordinates. */
function edges(pos: ReturnType<typeof computeAnchoredPanelPosition>, vw: number): [number, number] {
  const left = pos.left ?? vw - (pos.right ?? 0) - pos.width
  return [left, left + pos.width]
}

describe("computeAnchoredPanelPosition", () => {
  it("phones: a full-width sheet with side margins, whatever the trigger position", () => {
    for (const vw of [320, 360, 375, 390, 414, 430, 639]) {
      const pos = computeAnchoredPanelPosition({ anchor: { bottom: 56, right: 300 }, viewportWidth: vw })
      expect(pos).toEqual({ top: 64, left: 12, width: vw - 24 })
    }
  })

  it("the reported bug: a trigger with controls to its right no longer pushes the panel off-screen", () => {
    // iPhone-width screen, bell at x=328 with the language switcher and avatar to its right
    const vw = 390
    const pos = computeAnchoredPanelPosition({ anchor: { bottom: 52, right: 328 }, viewportWidth: vw })
    const [left, right] = edges(pos, vw)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(right).toBeLessThanOrEqual(vw)
  })

  it("larger screens: hangs from the trigger and is at most 26rem wide", () => {
    const pos = computeAnchoredPanelPosition({ anchor: { bottom: 56, right: 1200 }, viewportWidth: 1280 })
    expect(pos).toEqual({ top: 64, right: 80, width: PANEL_MAX_WIDTH_PX })
  })

  it("larger screens: shrinks instead of overflowing when the trigger is far from the right edge", () => {
    const pos = computeAnchoredPanelPosition({ anchor: { bottom: 56, right: 400 }, viewportWidth: 700 })
    const [left, right] = edges(pos, 700)
    expect(pos.right).toBe(300)
    expect(left).toBeGreaterThanOrEqual(12)
    expect(right).toBeLessThanOrEqual(700 - 12)
  })

  it("never leaves the viewport, for any trigger position and screen width", () => {
    for (let vw = 300; vw <= 1920; vw += 17) {
      for (let anchorRight = 40; anchorRight <= vw; anchorRight += 37) {
        const pos = computeAnchoredPanelPosition({ anchor: { bottom: 50, right: anchorRight }, viewportWidth: vw })
        const [left, right] = edges(pos, vw)
        expect(left, `vw=${vw} anchor=${anchorRight}`).toBeGreaterThanOrEqual(0)
        expect(right, `vw=${vw} anchor=${anchorRight}`).toBeLessThanOrEqual(vw)
        expect(pos.width).toBeGreaterThan(0)
      }
    }
  })

  it("keeps the margin when the trigger touches the right edge", () => {
    const pos = computeAnchoredPanelPosition({ anchor: { bottom: 56, right: 1280 }, viewportWidth: 1280 })
    expect(pos.right).toBe(12)
  })
})

describe("rightAlignedPanelLeft", () => {
  it("lines the panel up with the trigger's right edge when there is room", () => {
    expect(rightAlignedPanelLeft({ anchorRight: 360, panelWidth: 224, viewportWidth: 1280 })).toBe(136)
  })

  it("is clamped on both sides", () => {
    expect(rightAlignedPanelLeft({ anchorRight: 100, panelWidth: 320, viewportWidth: 375 })).toBe(8)
    // a 320px panel on a 320px screen cannot fit with margins, but never starts left of the margin
    expect(rightAlignedPanelLeft({ anchorRight: 300, panelWidth: 320, viewportWidth: 320 })).toBe(8)
    // trigger past the right edge of a narrow screen: the panel's right edge stays on screen
    const left = rightAlignedPanelLeft({ anchorRight: 400, panelWidth: 300, viewportWidth: 375 })
    expect(left + 300).toBeLessThanOrEqual(375 - 8)
  })

  it("keeps a panel that fits fully inside for any trigger position", () => {
    for (let vw = 340; vw <= 1600; vw += 23) {
      for (let r = 0; r <= vw + 40; r += 19) {
        const left = rightAlignedPanelLeft({ anchorRight: r, panelWidth: 320, viewportWidth: vw })
        expect(left).toBeGreaterThanOrEqual(8)
        expect(left + 320).toBeLessThanOrEqual(vw - 8)
      }
    }
  })
})
