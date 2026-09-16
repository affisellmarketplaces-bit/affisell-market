import { describe, expect, it } from "vitest"

import { resolvePublicNavBrowsePillVisibility } from "@/lib/public-nav-landing-pills"

describe("resolvePublicNavBrowsePillVisibility", () => {
  it("keeps Accueil · Marketplace · Pulse only on landing", () => {
    expect(
      resolvePublicNavBrowsePillVisibility({ landingPills: true, showMagicLab: true })
    ).toEqual({
      showBattles: false,
      showMagicLab: false,
      showTrustedStores: false,
    })
  })

  it("keeps Battles + stores (+ Magic Lab when role allows) elsewhere", () => {
    expect(
      resolvePublicNavBrowsePillVisibility({ landingPills: false, showMagicLab: true })
    ).toEqual({
      showBattles: true,
      showMagicLab: true,
      showTrustedStores: true,
    })
    expect(
      resolvePublicNavBrowsePillVisibility({ landingPills: false, showMagicLab: false })
    ).toEqual({
      showBattles: true,
      showMagicLab: false,
      showTrustedStores: true,
    })
  })
})
