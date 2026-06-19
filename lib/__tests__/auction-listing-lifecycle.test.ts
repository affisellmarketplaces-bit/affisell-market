import { describe, expect, it, vi, beforeEach } from "vitest"

const { updateMany, findMany, affiliateFindMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findMany: vi.fn(),
  affiliateFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auction: { updateMany, findMany },
    affiliateProduct: { findMany: affiliateFindMany },
  },
}))

import {
  cancelAuctionsForListings,
  retireIneligibleAuctionLots,
} from "@/lib/auction-listing-lifecycle"

describe("auction-listing-lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("cancels live auctions for listing ids", async () => {
    updateMany.mockResolvedValue({ count: 2 })

    const count = await cancelAuctionsForListings(["a", "b"])
    expect(count).toBe(2)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ listingId: { in: ["a", "b"] } }),
        data: { status: "CANCELLED" },
      })
    )
  })

  it("retires lots for unlisted or opted-out listings", async () => {
    findMany.mockResolvedValueOnce([{ listingId: "l1" }, { listingId: "l2" }])
    affiliateFindMany.mockResolvedValueOnce([{ id: "l2" }])
    updateMany.mockResolvedValue({ count: 1 })

    const count = await retireIneligibleAuctionLots(new Date("2026-06-18T12:00:00Z"))
    expect(count).toBe(1)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ listingId: { in: ["l2"] } }),
      })
    )
  })
})
