import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, findUnique, retrieve, list } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  retrieve: vi.fn(),
  list: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany, findUnique },
  },
}))

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    checkout: {
      sessions: { retrieve, list },
    },
  }),
}))

vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  ensureMarketplaceCheckoutFulfilled: vi.fn(),
}))

vi.mock("@/lib/stripe-marketplace-commission-split", () => ({
  findOrderIdsForCheckoutSession: vi.fn().mockResolvedValue(["order_1"]),
}))

vi.mock("@/lib/transfers/schedule-from-checkout", () => ({
  scheduleMarketplaceTransferAttempts: vi.fn(),
}))

import { ensureMarketplaceCheckoutFulfilled } from "@/lib/marketplace-checkout-fulfill"
import { reconcilePartnerPendingCheckoutOrders } from "@/lib/cron/reconcile-partner-pending-checkouts"

describe("reconcilePartnerPendingCheckoutOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("heals paid Stripe sessions for a supplier", async () => {
    findMany.mockResolvedValue([
      { id: "order_1", stripeSessionId: "cs_test_partner" },
    ])
    retrieve.mockResolvedValue({
      id: "cs_test_partner",
      mode: "payment",
      payment_status: "paid",
    })
    findUnique.mockResolvedValue({ status: "paid" })

    const result = await reconcilePartnerPendingCheckoutOrders({ supplierId: "sup_1" })

    expect(result).toEqual({ scanned: 1, healed: 1 })
    expect(ensureMarketplaceCheckoutFulfilled).toHaveBeenCalledOnce()
  })

  it("skips unpaid Stripe sessions", async () => {
    findMany.mockResolvedValue([
      { id: "order_2", stripeSessionId: "cs_test_unpaid" },
    ])
    retrieve.mockResolvedValue({
      id: "cs_test_unpaid",
      mode: "payment",
      payment_status: "unpaid",
    })

    const result = await reconcilePartnerPendingCheckoutOrders({ affiliateId: "aff_1" })

    expect(result).toEqual({ scanned: 1, healed: 0 })
    expect(ensureMarketplaceCheckoutFulfilled).not.toHaveBeenCalled()
  })
})
