import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, count } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany, count } },
}))

vi.mock("@/lib/stripe-marketplace-commission-split", () => ({
  findOrderIdsForCheckoutSession: vi.fn(async () => ["o1"]),
}))

vi.mock("@/lib/ghost/post-pay-reverify", () => ({ ghostReverifyBeforeFulfill: vi.fn() }))
vi.mock("@/lib/marketplace-checkout-session", () => ({ extractMarketplaceCheckoutCustomer: vi.fn() }))
vi.mock("@/lib/marketplace-checkout-cart-clear.server", () => ({ clearPurchasedCartItems: vi.fn() }))
vi.mock("@/lib/after-response", () => ({ runAfterResponse: vi.fn() }))
vi.mock("@/lib/stripe-marketplace-fulfill", () => ({ fulfillMarketplaceStripeSession: vi.fn() }))
vi.mock("@/lib/stripe-sync-order-vat-from-session", () => ({ syncOrderVatFromCheckoutSession: vi.fn() }))
vi.mock("@/lib/stripe-webhook-observability", () => ({ logStripeWebhookInfo: vi.fn() }))

import { marketplaceCheckoutNeedsFulfillment } from "@/lib/marketplace-checkout-fulfill"

describe("marketplaceCheckoutNeedsFulfillment", () => {
  beforeEach(() => {
    count.mockReset()
    findMany.mockReset()
  })

  it("needs fulfill when paid orders still have empty buyer email (settle race)", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([{ customerEmail: "" }])
    expect(await marketplaceCheckoutNeedsFulfillment("cs_1")).toBe(true)
  })

  it("is done when all paid rows have a buyer email", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([{ customerEmail: "buyer@example.com" }])
    expect(await marketplaceCheckoutNeedsFulfillment("cs_1")).toBe(false)
  })
})
