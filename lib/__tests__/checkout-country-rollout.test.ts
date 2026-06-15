import { describe, expect, it } from "vitest"

import {
  isRolloutOnlyCheckoutCountry,
  mergeCheckoutAllowedCountries,
} from "@/lib/checkout-country-rollout"

describe("checkout-country-rollout", () => {
  it("mergeCheckoutAllowedCountries dedupes and uppercases", () => {
    expect(mergeCheckoutAllowedCountries(["fr", "de"], ["jp", "FR"])).toEqual(["DE", "FR", "JP"])
  })

  it("isRolloutOnlyCheckoutCountry flags rollout-only codes", () => {
    expect(isRolloutOnlyCheckoutCountry("JP", ["JP"], ["FR", "DE"])).toBe(true)
    expect(isRolloutOnlyCheckoutCountry("FR", ["JP", "FR"], ["FR", "DE"])).toBe(false)
    expect(isRolloutOnlyCheckoutCountry("US", ["JP"], ["FR", "DE"])).toBe(false)
  })
})
