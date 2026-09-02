import { describe, expect, it } from "vitest"

import {
  hasAffiliateCatalogListing,
  listingWasEverStorefrontLive,
  resolveCatalogListingState,
} from "@/lib/affiliate-catalog-listing-state"

describe("resolveCatalogListingState", () => {
  it("returns none when no affiliate listing exists", () => {
    expect(resolveCatalogListingState([])).toEqual({ kind: "none" })
    expect(resolveCatalogListingState(null)).toEqual({ kind: "none" })
  })

  it("returns live when a listed row exists", () => {
    expect(
      resolveCatalogListingState([
        { id: "a", isListed: false, clicks: 0, conversions: 0 },
        { id: "b", isListed: true, clicks: 2, conversions: 0 },
      ])
    ).toEqual({ kind: "live", listingId: "b" })
  })

  it("treats draft invitation / never-live listing as ready (not relist)", () => {
    expect(
      resolveCatalogListingState([{ id: "draft-1", isListed: false, clicks: 0, conversions: 0 }])
    ).toEqual({ kind: "ready", listingId: "draft-1" })
  })

  it("treats previously engaged unlisted listing as hidden (true relist)", () => {
    expect(
      resolveCatalogListingState([{ id: "old-1", isListed: false, clicks: 3, conversions: 0 }])
    ).toEqual({ kind: "hidden", listingId: "old-1" })
    expect(
      resolveCatalogListingState([{ id: "old-2", isListed: false, clicks: 0, conversions: 1 }])
    ).toEqual({ kind: "hidden", listingId: "old-2" })
  })
})

describe("listingWasEverStorefrontLive", () => {
  it("is false for pristine drafts", () => {
    expect(listingWasEverStorefrontLive({ id: "x", isListed: false })).toBe(false)
  })

  it("is true with clicks or conversions", () => {
    expect(listingWasEverStorefrontLive({ id: "x", isListed: false, clicks: 1 })).toBe(true)
    expect(listingWasEverStorefrontLive({ id: "x", isListed: false, conversions: 1 })).toBe(true)
  })
})

describe("hasAffiliateCatalogListing", () => {
  it("is true for draft or live imports", () => {
    expect(hasAffiliateCatalogListing([])).toBe(false)
    expect(hasAffiliateCatalogListing([{ id: "d", isListed: false }])).toBe(true)
    expect(hasAffiliateCatalogListing([{ id: "l", isListed: true }])).toBe(true)
  })
})
