import { beforeEach, describe, expect, it, vi } from "vitest"

const { deleteMany, findMany, findOrderIds } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  findOrderIds: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany }, cartItem: { deleteMany } } }))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({ findOrderIdsForCheckoutSession: findOrderIds }))

import { clearPurchasedCartItems } from "@/lib/marketplace-checkout-cart-clear.server"

const session = (metadata: Record<string, string>) => ({ id: "cs_1", metadata }) as never

describe("clearPurchasedCartItems", () => {
  beforeEach(() => {
    deleteMany.mockReset().mockResolvedValue({ count: 2 })
    findMany.mockReset().mockResolvedValue([{ affiliateProductId: "L1" }, { affiliateProductId: "L1" }, { affiliateProductId: "L2" }])
    findOrderIds.mockReset().mockResolvedValue(["o1", "o2", "o3"])
  })

  it("removes only the purchased listings from the buyer's own cart", async () => {
    expect(await clearPurchasedCartItems(session({ buyerUserId: "u1" }))).toBe(2)
    expect(deleteMany).toHaveBeenCalledWith({
      where: { affiliateProductId: { in: ["L1", "L2"] }, cart: { userId: "u1" } },
    })
  })

  it("does nothing for a guest checkout (no buyer) or when no order exists yet", async () => {
    expect(await clearPurchasedCartItems(session({}))).toBe(0)
    findOrderIds.mockResolvedValueOnce([])
    expect(await clearPurchasedCartItems(session({ buyerUserId: "u1" }))).toBe(0)
    expect(deleteMany).not.toHaveBeenCalled()
  })
})
