import { describe, expect, it } from "vitest"

import {
  AFFILIATE_HUB_BATTLE_HREF,
  AFFILIATE_HUB_SWIPE_HREF,
  parseAffiliateHubMode,
} from "@/lib/affiliate-routes"

describe("affiliate hub modes", () => {
  it("parses exclusive battle vs swipe modes", () => {
    expect(parseAffiliateHubMode("battle")).toBe("battle")
    expect(parseAffiliateHubMode("swipe")).toBe("swipe")
    expect(parseAffiliateHubMode(null)).toBe("hub")
    expect(parseAffiliateHubMode("")).toBe("hub")
    expect(parseAffiliateHubMode("other")).toBe("hub")
  })

  it("keeps battle and swipe deep links distinct", () => {
    expect(AFFILIATE_HUB_BATTLE_HREF).toContain("mode=battle")
    expect(AFFILIATE_HUB_SWIPE_HREF).toContain("mode=swipe")
    expect(AFFILIATE_HUB_BATTLE_HREF).not.toEqual(AFFILIATE_HUB_SWIPE_HREF)
  })
})
