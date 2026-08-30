import { describe, expect, it } from "vitest"

import {
  AFFISELL_MOBILE_DOCK_OFFSET,
  AFFISELL_MOBILE_STICKY_ABOVE_DOCK,
  AFFISELL_SITE_HEADER_OFFSET_STICKY,
  isImmersiveBuyerRoute,
} from "@/lib/mobile-chrome"

describe("mobile-chrome offsets", () => {
  it("references shared CSS variables for dock spacing", () => {
    expect(AFFISELL_MOBILE_DOCK_OFFSET).toContain("--affisell-mobile-dock-offset")
    expect(AFFISELL_MOBILE_STICKY_ABOVE_DOCK).toContain("--affisell-mobile-sticky-above-dock")
    expect(AFFISELL_SITE_HEADER_OFFSET_STICKY).toContain("--affisell-site-header-offset-sticky")
  })

  it("keeps safe-area fallbacks for iOS home indicator", () => {
    expect(AFFISELL_MOBILE_DOCK_OFFSET).toContain("safe-area-inset-bottom")
    expect(AFFISELL_MOBILE_STICKY_ABOVE_DOCK).toContain("safe-area-inset-bottom")
    expect(AFFISELL_SITE_HEADER_OFFSET_STICKY).toContain("safe-area-inset-top")
  })

  it("treats bestsellers hub as a scrollable catalog, not immersive PDP", () => {
    expect(isImmersiveBuyerRoute("/marketplace/bestsellers")).toBe(false)
    expect(isImmersiveBuyerRoute("/marketplace/cmpmibth80001la04ysgbjef6")).toBe(true)
  })
})
