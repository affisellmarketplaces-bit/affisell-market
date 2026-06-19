import { describe, expect, it, vi, beforeEach } from "vitest"

const { deleteMany, updateMany, findMany, groupBy, cancelAuctionsForListings } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  cancelAuctionsForListings: vi.fn(),
}))

vi.mock("@/lib/auction-listing-lifecycle", () => ({
  cancelAuctionsForListings,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findMany, deleteMany, updateMany },
    order: { groupBy },
  },
}))

import { removeAffiliateListingsFromStorefront } from "@/lib/affiliate-listing-remove"

describe("removeAffiliateListingsFromStorefront", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes listings with no orders", async () => {
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }])
    groupBy.mockResolvedValue([])
    deleteMany.mockResolvedValue({ count: 2 })

    const result = await removeAffiliateListingsFromStorefront("aff-1", ["a", "b"])
    expect(result).toEqual({ deletedIds: ["a", "b"], hiddenIds: [] })
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] }, affiliateId: "aff-1" },
    })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it("hides listings that have orders", async () => {
    findMany.mockResolvedValue([{ id: "sold" }])
    groupBy.mockResolvedValue([{ affiliateProductId: "sold", _count: { _all: 2 } }])
    updateMany.mockResolvedValue({ count: 1 })

    const result = await removeAffiliateListingsFromStorefront("aff-1", ["sold"])
    expect(result).toEqual({ deletedIds: [], hiddenIds: ["sold"] })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sold"] }, affiliateId: "aff-1" },
      data: { isListed: false, isFeatured: false, auctionEligible: false },
    })
    expect(cancelAuctionsForListings).toHaveBeenCalledWith(["sold"])
  })
})
