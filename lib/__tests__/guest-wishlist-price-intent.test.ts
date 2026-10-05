import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  gFindUnique: vi.fn(),
  gCreate: vi.fn(),
  gDelete: vi.fn(),
  gFindMany: vi.fn(),
  gDeleteMany: vi.fn(),
  wFindMany: vi.fn(),
  wCreateMany: vi.fn(),
  likeCount: vi.fn(),
  prices: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    guestWishlist: {
      findUnique: m.gFindUnique,
      create: m.gCreate,
      delete: m.gDelete,
      findMany: m.gFindMany,
      deleteMany: m.gDeleteMany,
    },
    wishlist: { findMany: m.wFindMany, createMany: m.wCreateMany },
  },
}))
vi.mock("@/lib/product-like-count", () => ({ countProductLikesSingle: m.likeCount }))
vi.mock("@/lib/wishlist-current-price.server", () => ({ currentPricesForProducts: m.prices }))

import {
  listGuestWishlistForDisplay,
  mergeGuestWishlistForUser,
  toggleGuestWishlist,
} from "@/lib/guest-wishlist-server"

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.likeCount.mockResolvedValue(3)
  m.prices.mockResolvedValue(new Map())
  m.wFindMany.mockResolvedValue([])
  m.wCreateMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

describe("toggleGuestWishlist keeps the price intent", () => {
  it("stores the alert target and the baseline price when a guest saves a product", async () => {
    m.gFindUnique.mockResolvedValue(null)
    await expect(
      toggleGuestWishlist("g1", "p1", { targetPriceCents: 1443, previousPriceCents: 1519 })
    ).resolves.toEqual({ wished: true, likeCount: 3 })
    expect(m.gCreate).toHaveBeenCalledWith({
      data: { guestId: "g1", productId: "p1", targetPriceCents: 1443, previousPriceCents: 1519 },
    })
  })

  it("still works without any price intent (plain like) and un-saving removes the row", async () => {
    m.gFindUnique.mockResolvedValueOnce(null)
    await toggleGuestWishlist("g1", "p1")
    expect(m.gCreate.mock.calls[0]![0].data).toMatchObject({ targetPriceCents: null, previousPriceCents: null })

    m.gFindUnique.mockResolvedValueOnce({ id: "row" })
    await expect(toggleGuestWishlist("g1", "p1", { targetPriceCents: 1 })).resolves.toEqual({ wished: false, likeCount: 3 })
    expect(m.gDelete).toHaveBeenCalledWith({ where: { guestId_productId: { guestId: "g1", productId: "p1" } } })
  })
})

describe("mergeGuestWishlistForUser carries the alert into the account", () => {
  it("copies target + baseline, so the price alert still fires after sign-up", async () => {
    m.gFindMany.mockResolvedValue([{ productId: "p1", targetPriceCents: 1443, previousPriceCents: 1519 }])
    const res = await mergeGuestWishlistForUser("u1", "g1")
    expect(res).toEqual({ merged: 1, skipped: 0 })
    expect(m.wCreateMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", productId: "p1", targetPriceCents: 1443, previousPriceCents: 1519 }],
      skipDuplicates: true,
    })
    expect(m.gDeleteMany).toHaveBeenCalledWith({ where: { guestId: "g1" } })
  })

  it("gives a favourite saved before price intent was kept today's price as its baseline", async () => {
    m.gFindMany.mockResolvedValue([
      { productId: "old", targetPriceCents: null, previousPriceCents: null },
      { productId: "gone", targetPriceCents: null, previousPriceCents: null },
    ])
    m.prices.mockResolvedValue(new Map([["old", 2500]]))
    await mergeGuestWishlistForUser("u1", "g1")
    expect(m.prices).toHaveBeenCalledWith(["old", "gone"])
    expect(m.wCreateMany.mock.calls[0]![0].data).toEqual([
      { userId: "u1", productId: "old", targetPriceCents: null, previousPriceCents: 2500 },
      // no live listing → no baseline (the first alert run records one)
      { userId: "u1", productId: "gone", targetPriceCents: null, previousPriceCents: null },
    ])
  })

  it("never overwrites a favourite the buyer already has, and is idempotent", async () => {
    m.gFindMany.mockResolvedValue([
      { productId: "have", targetPriceCents: 100, previousPriceCents: 200 },
      { productId: "new", targetPriceCents: 300, previousPriceCents: 400 },
    ])
    m.wFindMany.mockResolvedValue([{ productId: "have" }])
    const res = await mergeGuestWishlistForUser("u1", "g1")
    expect(res).toEqual({ merged: 1, skipped: 1 })
    expect(m.wCreateMany.mock.calls[0]![0].data.map((r: { productId: string }) => r.productId)).toEqual(["new"])
  })

  it("is a no-op without a guest id, a user id or any guest rows (and creates nothing)", async () => {
    await expect(mergeGuestWishlistForUser("u1", "  ")).resolves.toEqual({ merged: 0, skipped: 0 })
    await expect(mergeGuestWishlistForUser("", "g1")).resolves.toEqual({ merged: 0, skipped: 0 })
    m.gFindMany.mockResolvedValue([])
    await expect(mergeGuestWishlistForUser("u1", "g1")).resolves.toEqual({ merged: 0, skipped: 0 })
    expect(m.wCreateMany).not.toHaveBeenCalled()
    expect(m.gDeleteMany).not.toHaveBeenCalled()
  })

  it("when everything already exists it still clears the guest rows without creating anything", async () => {
    m.gFindMany.mockResolvedValue([{ productId: "have", targetPriceCents: null, previousPriceCents: null }])
    m.wFindMany.mockResolvedValue([{ productId: "have" }])
    await expect(mergeGuestWishlistForUser("u1", "g1")).resolves.toEqual({ merged: 0, skipped: 1 })
    expect(m.wCreateMany).not.toHaveBeenCalled()
    expect(m.gDeleteMany).toHaveBeenCalledTimes(1)
  })
})

describe("listGuestWishlistForDisplay", () => {
  const row = (previous: number | null, listingPrice: number | null) => ({
    productId: "p1",
    targetPriceCents: 900,
    previousPriceCents: previous,
    product: {
      name: "Masque",
      images: ["https://cdn.example.com/a.jpg"],
      affiliateProducts: listingPrice == null ? [] : [{ id: "l1", sellingPriceCents: listingPrice }],
    },
  })

  it("shows the saved target and the drop since the saved price", async () => {
    m.gFindMany.mockResolvedValue([row(1000, 800)])
    const [item] = await listGuestWishlistForDisplay("g1")
    expect(item).toMatchObject({ targetPriceCents: 900, currentPriceCents: 800, dropPercent: 20 })
  })

  it("a product with no live listing is never shown as a 100 % drop", async () => {
    m.gFindMany.mockResolvedValue([row(1000, null)])
    const [item] = await listGuestWishlistForDisplay("g1")
    expect(item).toMatchObject({ currentPriceCents: null, dropPercent: 0 })
  })
})
