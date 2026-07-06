import { describe, expect, it } from "vitest"

import {
  AFFILIATE_CREATORS_WATCHING_MIN,
  shouldShowAffiliateCreatorsWatchingBadge,
} from "@/lib/affiliate-product-opportunity-pulse-shared"

describe("affiliate-product-opportunity-pulse-shared", () => {
  it("shows badge from minimum threshold", () => {
    expect(AFFILIATE_CREATORS_WATCHING_MIN).toBe(2)
    expect(shouldShowAffiliateCreatorsWatchingBadge(0)).toBe(false)
    expect(shouldShowAffiliateCreatorsWatchingBadge(1)).toBe(false)
    expect(shouldShowAffiliateCreatorsWatchingBadge(2)).toBe(true)
    expect(shouldShowAffiliateCreatorsWatchingBadge(5)).toBe(true)
  })
})
