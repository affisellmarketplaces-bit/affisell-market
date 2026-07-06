import { describe, expect, it, vi } from "vitest"

import {
  parseE2eCreatorsWatchingOverride,
  shouldUseE2eLtvLoopFixtures,
} from "@/lib/e2e-ltv-loop-fixtures"
import { shouldUseE2eStorefrontFlashSaleFixtures } from "@/lib/e2e-storefront-flash-sale-fixtures"

describe("e2e-ltv-loop-fixtures", () => {
  it("parses creators watching override when fixtures enabled", () => {
    expect(parseE2eCreatorsWatchingOverride("3", true)).toBe(3)
    expect(parseE2eCreatorsWatchingOverride("1", true)).toBe(1)
    expect(parseE2eCreatorsWatchingOverride("3", false)).toBeNull()
  })

  it("enables storefront flash sale fixtures via query in non-production", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(shouldUseE2eStorefrontFlashSaleFixtures({ e2eFlashSale: "1" })).toBe(true)
    expect(shouldUseE2eLtvLoopFixtures({ e2eFixtures: "1" })).toBe(true)
    vi.unstubAllEnvs()
  })
})
