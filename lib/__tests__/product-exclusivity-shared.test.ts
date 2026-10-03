import { describe, expect, it } from "vitest"

import {
  affiliateExclusivityState,
  canSupplierRevokeExclusivity,
  catalogExclusivityWhere,
  clampExclusivityDays,
  EXCLUSIVITY_DEFAULT_DAYS,
  EXCLUSIVITY_MAX_DAYS,
  EXCLUSIVITY_MIN_DAYS,
  exclusiveHolderOf,
  exclusivityBlocksAffiliate,
  exclusivityEndsAt,
  isExclusivityActive,
} from "@/lib/product-exclusivity-shared"

const NOW = new Date("2026-10-03T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000
const future = new Date(NOW.getTime() + 10 * DAY)
const past = new Date(NOW.getTime() - 1)

describe("exclusivity window", () => {
  it("is active only while the end date is in the future and a holder is set", () => {
    expect(exclusiveHolderOf({ exclusiveAffiliateId: "a1", exclusiveUntil: future }, NOW)).toBe("a1")
    expect(isExclusivityActive({ exclusiveAffiliateId: "a1", exclusiveUntil: future.toISOString() }, NOW)).toBe(true)
    // expired — including the exact end instant
    expect(isExclusivityActive({ exclusiveAffiliateId: "a1", exclusiveUntil: past }, NOW)).toBe(false)
    expect(isExclusivityActive({ exclusiveAffiliateId: "a1", exclusiveUntil: NOW }, NOW)).toBe(false)
    // incomplete / garbage rows never lock a product
    expect(isExclusivityActive({ exclusiveAffiliateId: null, exclusiveUntil: future }, NOW)).toBe(false)
    expect(isExclusivityActive({ exclusiveAffiliateId: "a1", exclusiveUntil: null }, NOW)).toBe(false)
    expect(isExclusivityActive({ exclusiveAffiliateId: "  ", exclusiveUntil: future }, NOW)).toBe(false)
    expect(isExclusivityActive({ exclusiveAffiliateId: "a1", exclusiveUntil: "nope" }, NOW)).toBe(false)
    expect(isExclusivityActive({}, NOW)).toBe(false)
  })
})

describe("exclusivityBlocksAffiliate", () => {
  const product = { exclusiveAffiliateId: "holder", exclusiveUntil: future }

  it("blocks everyone but the holder while active", () => {
    expect(exclusivityBlocksAffiliate(product, "someone-else", NOW)).toBe(true)
    expect(exclusivityBlocksAffiliate(product, "holder", NOW)).toBe(false)
  })

  it("blocks nobody once expired or when the product is open", () => {
    expect(exclusivityBlocksAffiliate({ ...product, exclusiveUntil: past }, "someone-else", NOW)).toBe(false)
    expect(exclusivityBlocksAffiliate({}, "someone-else", NOW)).toBe(false)
  })
})

describe("term", () => {
  it("clamps to the allowed range and defaults on junk", () => {
    expect(clampExclusivityDays(30)).toBe(30)
    expect(clampExclusivityDays("45")).toBe(45)
    expect(clampExclusivityDays(2)).toBe(EXCLUSIVITY_MIN_DAYS)
    expect(clampExclusivityDays(10_000)).toBe(EXCLUSIVITY_MAX_DAYS)
    expect(clampExclusivityDays(29.6)).toBe(30)
    for (const junk of [undefined, null, "abc", Number.NaN, {}, Infinity]) {
      expect(clampExclusivityDays(junk)).toBe(EXCLUSIVITY_DEFAULT_DAYS)
    }
  })

  it("computes the end date from the clamped term", () => {
    expect(exclusivityEndsAt(NOW, 30).getTime()).toBe(NOW.getTime() + 30 * DAY)
    expect(exclusivityEndsAt(NOW, 1).getTime()).toBe(NOW.getTime() + EXCLUSIVITY_MIN_DAYS * DAY)
  })
})

describe("supplier cooling-off", () => {
  it("lets the supplier undo a grant only within 48 hours", () => {
    expect(canSupplierRevokeExclusivity(new Date(NOW.getTime() - 47 * 3_600_000), NOW)).toBe(true)
    expect(canSupplierRevokeExclusivity(new Date(NOW.getTime() - 48 * 3_600_000), NOW)).toBe(true)
    expect(canSupplierRevokeExclusivity(new Date(NOW.getTime() - 49 * 3_600_000), NOW)).toBe(false)
    expect(canSupplierRevokeExclusivity(null, NOW)).toBe(false)
    expect(canSupplierRevokeExclusivity("garbage", NOW)).toBe(false)
  })
})

describe("catalogExclusivityWhere", () => {
  it("keeps open products, expired grants and the reseller's own exclusives — hides other resellers'", () => {
    expect(catalogExclusivityWhere("me", NOW)).toEqual({
      OR: [
        { exclusiveAffiliateId: null },
        { exclusiveUntil: null },
        { exclusiveUntil: { lte: NOW } },
        { exclusiveAffiliateId: "me" },
      ],
    })
  })
})

describe("affiliateExclusivityState", () => {
  const mine = { exclusiveAffiliateId: "me", exclusiveUntil: future }
  const theirs = { exclusiveAffiliateId: "them", exclusiveUntil: future }

  it("distinguishes mine / other / requested / none", () => {
    expect(affiliateExclusivityState({ product: mine, affiliateId: "me", hasOpenRequest: false, now: NOW })).toBe("mine")
    expect(affiliateExclusivityState({ product: theirs, affiliateId: "me", hasOpenRequest: true, now: NOW })).toBe("other")
    expect(affiliateExclusivityState({ product: {}, affiliateId: "me", hasOpenRequest: true, now: NOW })).toBe("requested")
    expect(affiliateExclusivityState({ product: {}, affiliateId: "me", hasOpenRequest: false, now: NOW })).toBe("none")
    // an expired grant no longer counts
    expect(
      affiliateExclusivityState({
        product: { exclusiveAffiliateId: "me", exclusiveUntil: past },
        affiliateId: "me",
        hasOpenRequest: false,
        now: NOW,
      })
    ).toBe("none")
  })
})
