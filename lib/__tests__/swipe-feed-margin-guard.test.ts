import { beforeEach, describe, expect, it, vi } from "vitest"

const findMany = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany },
    affiliateSwipe: { findMany: vi.fn(async () => []) },
    affiliateProduct: { findMany: vi.fn(async () => []) },
  },
}))

import { SWIPE_GUARD_MAX_PAGES, loadSwipeFeedProducts } from "@/lib/affiliate-swipe-feed.server"

const row = (id: string, basePriceCents: number, commissionRate: number) => ({
  id,
  name: id,
  images: [],
  categories: [],
  basePriceCents,
  commissionRate,
  deliveryMax: null,
  supplier: { email: "s@example.com", isVerifiedSupplier: false, store: null },
})
// 5.00 € at 5 %: net 1.40 € -> rejected by the guard. 30.00 € at 10 %: net 9.60 € -> recommended.
const poor = (i: number) => row(`poor_${i}`, 500, 5)
const good = (i: number) => row(`good_${i}`, 3_000, 10)

describe("swipe feed + net-margin guard", () => {
  beforeEach(() => findMany.mockReset())

  it("reads further pages when the first one is entirely rejected (Vercel Agent review)", async () => {
    findMany
      .mockResolvedValueOnce(Array.from({ length: 6 }, (_, i) => poor(i)))
      .mockResolvedValueOnce([good(1), poor(9), good(2), good(3), poor(10), poor(11)])
    const feed = await loadSwipeFeedProducts("aff_000001", {}, 3)
    expect(feed.map((p) => p.id)).toEqual(["good_1", "good_2", "good_3"])
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(findMany.mock.calls[1]![0]).toMatchObject({ skip: 6, take: 6 })
  })

  it("stops at the end of the catalog and never exceeds the page bound", async () => {
    findMany.mockResolvedValue(Array.from({ length: 6 }, (_, i) => poor(i)))
    const feed = await loadSwipeFeedProducts("aff_000001", {}, 3)
    expect(feed).toEqual([])
    expect(findMany).toHaveBeenCalledTimes(SWIPE_GUARD_MAX_PAGES)
    findMany.mockReset()
    findMany.mockResolvedValueOnce([poor(1), good(1)])
    expect((await loadSwipeFeedProducts("aff_000001", {}, 3)).map((p) => p.id)).toEqual(["good_1"])
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
