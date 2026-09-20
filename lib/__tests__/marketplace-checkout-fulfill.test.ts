import { beforeEach, describe, expect, it, vi } from "vitest"

const { count, findMany, findOrderIdsForCheckoutSession } = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  findOrderIdsForCheckoutSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { count, findMany },
  },
}))

vi.mock("@/lib/stripe-marketplace-commission-split", () => ({
  findOrderIdsForCheckoutSession,
}))

import {
  isMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
} from "@/lib/marketplace-checkout-fulfill"

describe("marketplace checkout fulfillment guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("needs fulfillment when no order rows exist", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue([])
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_1")).resolves.toBe(true)
    expect(count).not.toHaveBeenCalled()
  })

  it("needs fulfillment when pre-created rows are still PENDING", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["order_pending"])
    count.mockResolvedValue(1)
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_2")).resolves.toBe(true)
  })

  it("does not need fulfillment when all rows are paid with buyer email", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["order_paid"])
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([{ customerEmail: "buyer@example.com" }])
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_3")).resolves.toBe(false)
  })

  it("needs fulfillment when paid rows still miss buyer email", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["order_paid"])
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([{ customerEmail: "" }])
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_3b")).resolves.toBe(true)
  })

  it("is fulfilled only when rows exist and none are unpaid", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce([])
    await expect(isMarketplaceCheckoutFulfilled("cs_test_4")).resolves.toBe(false)

    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce(["order_paid"])
    count.mockResolvedValueOnce(0)
    await expect(isMarketplaceCheckoutFulfilled("cs_test_5")).resolves.toBe(true)

    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce(["order_pending"])
    count.mockResolvedValueOnce(1)
    await expect(isMarketplaceCheckoutFulfilled("cs_test_6")).resolves.toBe(false)
  })
})
