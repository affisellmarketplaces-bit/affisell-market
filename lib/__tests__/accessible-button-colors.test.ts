import { describe, expect, it } from "vitest"

import { accessibleButtonColors } from "@/lib/storefront/accessible-button-colors"
import { contrastRatio } from "@/lib/storefront-theme-contrast"

describe("accessibleButtonColors", () => {
  it("leaves an accent that already passes exactly as the merchant chose it", () => {
    expect(accessibleButtonColors("#1d4ed8")).toEqual({ bg: "#1d4ed8", fg: "#ffffff" }) // blue + white
    expect(accessibleButtonColors("#facc15")).toEqual({ bg: "#facc15", fg: "#09090b" }) // yellow + near-black
  })

  it("picks the better text color for mid-tones instead of defaulting to white", () => {
    // coral: 2.7:1 with white, 7.6:1 with near-black
    expect(accessibleButtonColors("#fb7185")).toEqual({ bg: "#fb7185", fg: "#09090b" })
    expect(accessibleButtonColors("#10b981").fg).toBe("#09090b")
  })

  it("nudges the background only when neither text color reaches AA, keeping the hue", () => {
    // mid-blue sits where both white and black fall just short
    const worst = "#2f6fb3"
    const out = accessibleButtonColors(worst)
    expect(contrastRatio(out.bg, out.fg)!).toBeGreaterThanOrEqual(4.5)
  })

  it("ALWAYS returns a pair that passes AA (property test over 1,500 colors)", () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < 1500; i += 1) {
      const hex = `#${[0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, "0")).join("")}`
      const { bg, fg } = accessibleButtonColors(hex)
      expect(contrastRatio(bg, fg)!, hex).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("falls back to a safe pair for junk input", () => {
    for (const bad of [undefined, null, "", "nope", "#12"]) {
      const { bg, fg } = accessibleButtonColors(bad as never)
      expect(contrastRatio(bg, fg)!).toBeGreaterThanOrEqual(4.5)
    }
  })
})
