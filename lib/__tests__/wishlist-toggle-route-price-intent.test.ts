import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  guestId: vi.fn(),
  toggleGuest: vi.fn(),
  currentPrice: vi.fn(),
  productFindFirst: vi.fn(),
  wFindUnique: vi.fn(),
  wCreate: vi.fn(),
  wDelete: vi.fn(),
  likeCount: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/guest-wishlist-id", () => ({
  getOrCreateGuestWishlistId: m.guestId,
  readGuestWishlistId: vi.fn(),
}))
vi.mock("@/lib/guest-wishlist-server", () => ({
  toggleGuestWishlist: m.toggleGuest,
  guestWishlistProductIds: vi.fn(),
  listGuestWishlistForDisplay: vi.fn(),
}))
vi.mock("@/lib/wishlist-current-price.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/wishlist-current-price.server")>(
    "@/lib/wishlist-current-price.server"
  )
  return { ...actual, currentPriceForProduct: m.currentPrice, currentPricesForProducts: vi.fn() }
})
vi.mock("@/lib/product-like-count", () => ({ countProductLikesSingle: m.likeCount }))
vi.mock("@/lib/wishlist-card-status.server", () => ({ resolveWishlistCardStatuses: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findFirst: m.productFindFirst },
    wishlist: { findUnique: m.wFindUnique, create: m.wCreate, delete: m.wDelete },
  },
}))

import { POST } from "@/app/api/wishlist/route"

const post = (body: unknown) => new Request("http://x/api/wishlist", { method: "POST", body: JSON.stringify(body) })

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.productFindFirst.mockResolvedValue({ id: "p1" })
  m.likeCount.mockResolvedValue(5)
  m.guestId.mockResolvedValue("g1")
  m.toggleGuest.mockResolvedValue({ wished: true, likeCount: 5 })
  m.currentPrice.mockResolvedValue(1519)
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

describe("POST /api/wishlist — guest save keeps the price alert", () => {
  it("stores the 5 % target and today's price for a guest (no account needed)", async () => {
    m.auth.mockResolvedValue(null)
    const res = await POST(post({ productId: "p1", targetPrice: 14.43 }))
    expect(await res.json()).toEqual({ wished: true, likeCount: 5 })
    expect(m.toggleGuest).toHaveBeenCalledWith("g1", "p1", { targetPriceCents: 1443, previousPriceCents: 1519 })
  })

  it("ignores an invalid target but still records the baseline price", async () => {
    m.auth.mockResolvedValue(null)
    for (const targetPrice of [undefined, 0, -3, "12", Number.NaN]) {
      m.toggleGuest.mockClear()
      await POST(post({ productId: "p1", targetPrice }))
      expect(m.toggleGuest).toHaveBeenCalledWith("g1", "p1", { targetPriceCents: null, previousPriceCents: 1519 })
    }
  })

  it("a product with no live listing saves with no baseline instead of failing", async () => {
    m.auth.mockResolvedValue(null)
    m.currentPrice.mockResolvedValue(null)
    await POST(post({ productId: "p1", targetPrice: 10 }))
    expect(m.toggleGuest).toHaveBeenCalledWith("g1", "p1", { targetPriceCents: 1000, previousPriceCents: null })
  })

  it("signed-in saves are unchanged: the target and baseline go on the account row", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } })
    m.wFindUnique.mockResolvedValue(null)
    await POST(post({ productId: "p1", targetPrice: 14.43 }))
    expect(m.toggleGuest).not.toHaveBeenCalled()
    expect(m.wCreate).toHaveBeenCalledWith({
      data: { userId: "u1", productId: "p1", targetPriceCents: 1443, previousPriceCents: 1519 },
    })
  })

  it("rejects a missing or unknown product", async () => {
    m.auth.mockResolvedValue(null)
    expect((await POST(post({}))).status).toBe(400)
    m.productFindFirst.mockResolvedValue(null)
    expect((await POST(post({ productId: "nope" }))).status).toBe(404)
    expect(m.toggleGuest).not.toHaveBeenCalled()
  })
})
