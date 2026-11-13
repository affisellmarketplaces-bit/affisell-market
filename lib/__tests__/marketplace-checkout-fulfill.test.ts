import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, findOrderIdsForCheckoutSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findOrderIdsForCheckoutSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany },
  },
}))

vi.mock("@/lib/stripe-marketplace-commission-split", () => ({
  findOrderIdsForCheckoutSession,
}))

import {
  isMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
} from "@/lib/marketplace-checkout-fulfill"

const rows = (...statuses: string[]) =>
  statuses.map((status) => ({ status, paymentSettlementStatus: "PENDING", bookingSlotId: null, bookingConfirmedAt: null }))

describe("marketplace checkout fulfillment guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("needs fulfillment when no order rows exist", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue([])
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_1")).resolves.toBe(true)
    expect(findMany).not.toHaveBeenCalled()
  })

  it("needs fulfillment when pre-created rows are still PENDING", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["order_pending"])
    findMany.mockResolvedValue(rows("PENDING"))
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_2")).resolves.toBe(true)
  })

  it("needs fulfillment when only some of the rows are paid", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["a", "b"])
    findMany.mockResolvedValue(rows("paid", "PENDING"))
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_2b")).resolves.toBe(true)
  })

  it("needs fulfillment when the ids no longer resolve to rows", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["gone"])
    findMany.mockResolvedValue([])
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_2c")).resolves.toBe(true)
  })

  it("does not need fulfillment when all rows are paid", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["order_paid"])
    findMany.mockResolvedValue(rows("paid"))
    await expect(marketplaceCheckoutNeedsFulfillment("cs_test_3")).resolves.toBe(false)
  })

  // Finalisation review #9: this gate used to say "any status other than paid".
  it.each(["preparing", "fulfilling", "shipped", "delivered", "completed", "returned", "disputed", "refunded", "cancelled", "CANCELLED"])(
    "does NOT need fulfillment when the row is already %s (a replayed event must not re-enter the fulfilment of such an order)",
    async (status) => {
      vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValue(["order_x"])
      findMany.mockResolvedValue(rows(status))
      await expect(marketplaceCheckoutNeedsFulfillment("cs_test_past")).resolves.toBe(false)
    }
  )

  it("is fulfilled only when rows exist and every one is paid or past paid", async () => {
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce([])
    await expect(isMarketplaceCheckoutFulfilled("cs_test_4")).resolves.toBe(false)

    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce(["order_paid"])
    findMany.mockResolvedValueOnce(rows("paid"))
    await expect(isMarketplaceCheckoutFulfilled("cs_test_5")).resolves.toBe(true)

    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce(["a", "b"])
    findMany.mockResolvedValueOnce(rows("shipped", "fulfilling"))
    await expect(isMarketplaceCheckoutFulfilled("cs_test_5b")).resolves.toBe(true)

    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce(["order_pending"])
    findMany.mockResolvedValueOnce(rows("PENDING"))
    await expect(isMarketplaceCheckoutFulfilled("cs_test_6")).resolves.toBe(false)

    // a refunded / cancelled row is not "fulfilled" (the success page must not present it as a confirmed purchase)
    vi.mocked(findOrderIdsForCheckoutSession).mockResolvedValueOnce(["order_refunded"])
    findMany.mockResolvedValueOnce(rows("refunded"))
    await expect(isMarketplaceCheckoutFulfilled("cs_test_7")).resolves.toBe(false)
  })
})
