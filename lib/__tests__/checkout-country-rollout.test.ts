import { describe, expect, it } from "vitest"

import {
  isRolloutOnlyCheckoutCountry,
  mergeCheckoutAllowedCountries,
  mergeEffectiveCheckoutBase,
} from "@/lib/checkout-country-rollout"

describe("checkout-country-rollout", () => {
  it("mergeCheckoutAllowedCountries dedupes and uppercases", () => {
    expect(mergeCheckoutAllowedCountries(["fr", "de"], ["jp", "FR"])).toEqual(["DE", "FR", "JP"])
  })

  it("mergeEffectiveCheckoutBase treats graduated countries as permanent base", () => {
    const base = mergeEffectiveCheckoutBase(["FR", "DE"], ["JP"])
    expect(base).toEqual(["DE", "FR", "JP"])
    expect(isRolloutOnlyCheckoutCountry("JP", [], base)).toBe(false)
    expect(isRolloutOnlyCheckoutCountry("BR", ["BR"], base)).toBe(true)
  })

  it("isRolloutOnlyCheckoutCountry flags rollout-only codes", () => {
    expect(isRolloutOnlyCheckoutCountry("JP", ["JP"], ["FR", "DE"])).toBe(true)
    expect(isRolloutOnlyCheckoutCountry("FR", ["JP", "FR"], ["FR", "DE"])).toBe(false)
    expect(isRolloutOnlyCheckoutCountry("US", ["JP"], ["FR", "DE"])).toBe(false)
  })
})
