import { describe, expect, it, vi, beforeEach } from "vitest"

const { findManyAffiliateProduct } = vi.hoisted(() => ({
  findManyAffiliateProduct: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { affiliateProduct: { findMany: findManyAffiliateProduct } },
}))

import {
  loadGrowthPlanRankByListingId,
  sortListingsByGrowthPlanThenSponsorBoost,
} from "@/lib/growth/growth-plan-rank-boost"

describe("Growth plan ranking tie-breaker", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    findManyAffiliateProduct.mockReset()
  })

  it("never outranks a listing that's actually winning on sponsor score", () => {
    const rows = [{ id: "a" }, { id: "b" }]
    const sponsorScores = new Map([
      ["a", 0], // no active sponsor campaign
      ["b", 500], // paying Sponsor campaign, winning
    ])
    const growthRanks = new Map([["a", 2]]) // "a" is Empire — still must not beat "b"
    const sorted = sortListingsByGrowthPlanThenSponsorBoost(rows, sponsorScores, growthRanks)
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"])
  })

  it("breaks a tie in sponsor score (the common all-zero case) by growth plan rank", () => {
    const rows = [{ id: "free-tier" }, { id: "dominator" }, { id: "empire" }]
    const sponsorScores = new Map<string, number>() // nobody has an active campaign → all 0
    const growthRanks = new Map([
      ["dominator", 1],
      ["empire", 2],
    ])
    const sorted = sortListingsByGrowthPlanThenSponsorBoost(rows, sponsorScores, growthRanks)
    expect(sorted.map((r) => r.id)).toEqual(["empire", "dominator", "free-tier"])
  })

  it("two listings with the same rank keep their relative order (stable sort)", () => {
    const rows = [{ id: "d1" }, { id: "d2" }]
    const sponsorScores = new Map<string, number>()
    const growthRanks = new Map([
      ["d1", 1],
      ["d2", 1],
    ])
    const sorted = sortListingsByGrowthPlanThenSponsorBoost(rows, sponsorScores, growthRanks)
    expect(sorted.map((r) => r.id)).toEqual(["d1", "d2"])
  })

  it("loadGrowthPlanRankByListingId resolves rank via the listing's supplier's growth plan", async () => {
    findManyAffiliateProduct.mockResolvedValue([
      { id: "listing-1", product: { supplier: { growthPlan: "dominator" } } },
      { id: "listing-2", product: { supplier: { growthPlan: "empire" } } },
    ])
    const map = await loadGrowthPlanRankByListingId(["listing-1", "listing-2", "listing-3"])
    expect(map.get("listing-1")).toBe(1)
    expect(map.get("listing-2")).toBe(2)
    expect(map.has("listing-3")).toBe(false)
  })

  it("returns an empty map without querying when the id list is empty", async () => {
    const map = await loadGrowthPlanRankByListingId([])
    expect(map.size).toBe(0)
    expect(findManyAffiliateProduct).not.toHaveBeenCalled()
  })

  it("is bypassed entirely when GROWTH_RANK_BOOST_PAUSED is set", async () => {
    vi.stubEnv("GROWTH_RANK_BOOST_PAUSED", "1")
    const map = await loadGrowthPlanRankByListingId(["listing-1"])
    expect(map.size).toBe(0)
    expect(findManyAffiliateProduct).not.toHaveBeenCalled()
  })
})
