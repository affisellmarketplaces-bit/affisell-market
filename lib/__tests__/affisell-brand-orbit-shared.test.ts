import { describe, expect, it } from "vitest"

import {
  brandOrbitDeepShell,
  brandOrbitFooterShell,
  brandOrbitHeroShell,
  brandOrbitTrustStripShell,
} from "@/lib/affisell-brand-orbit-shared"

describe("affisell-brand-orbit-shared", () => {
  it("exports orbital shells with shared deep gradient", () => {
    expect(brandOrbitDeepShell).toContain("#312E81")
    expect(brandOrbitFooterShell).toContain(brandOrbitDeepShell)
    expect(brandOrbitHeroShell).toContain("from-violet-700")
    expect(brandOrbitTrustStripShell).toContain("#312E81")
  })
})
