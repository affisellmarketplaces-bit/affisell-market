import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  ghostReverifyBeforeFulfill: vi.fn(),
  fulfillMarketplaceStripeSession: vi.fn(),
  logStripeWebhookInfo: vi.fn(),
}))

vi.mock("@/lib/ghost/post-pay-reverify", () => ({ ghostReverifyBeforeFulfill: h.ghostReverifyBeforeFulfill }))
vi.mock("@/lib/stripe-marketplace-fulfill", () => ({ fulfillMarketplaceStripeSession: h.fulfillMarketplaceStripeSession }))
vi.mock("@/lib/stripe-webhook-observability", () => ({ logStripeWebhookInfo: h.logStripeWebhookInfo }))
vi.mock("@/lib/marketplace-checkout-session", () => ({
  extractMarketplaceCheckoutCustomer: () => ({ customerEmail: "b@example.test", shippingAddress: null }),
}))
vi.mock("@/lib/marketplace-checkout-cart-clear.server", () => ({ clearPurchasedCartItems: vi.fn(async () => 0) }))
vi.mock("@/lib/after-response", () => ({ runAfterResponse: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe-sync-order-vat-from-session", () => ({ syncOrderVatFromCheckoutSession: vi.fn() }))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({ findOrderIdsForCheckoutSession: vi.fn(async () => []) }))
vi.mock("@/lib/prisma", () => ({ prisma: { order: { count: vi.fn() } } }))

import { ensureMarketplaceCheckoutFulfilled } from "@/lib/marketplace-checkout-fulfill"

const paidSession = { id: "cs_1", mode: "payment", payment_status: "paid", metadata: {} } as never

beforeEach(() => vi.clearAllMocks())

describe("ensureMarketplaceCheckoutFulfilled — ghost out-of-stock", () => {
  it("does not fulfil when the out-of-stock refund FAILED (orders stay PENDING so the reconcile cron replays it)", async () => {
    h.ghostReverifyBeforeFulfill.mockResolvedValue({ refunded: false, refundFailed: true })
    await ensureMarketplaceCheckoutFulfilled(paidSession)
    expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
    expect(h.logStripeWebhookInfo).toHaveBeenCalledWith(expect.objectContaining({ metric: "ghost_oos_refund_failed" }))
  })

  it("does not fulfil after a successful out-of-stock refund either", async () => {
    h.ghostReverifyBeforeFulfill.mockResolvedValue({ refunded: true })
    await ensureMarketplaceCheckoutFulfilled(paidSession)
    expect(h.fulfillMarketplaceStripeSession).not.toHaveBeenCalled()
  })

  it("fulfils when nothing is out of stock", async () => {
    h.ghostReverifyBeforeFulfill.mockResolvedValue({ refunded: false })
    await ensureMarketplaceCheckoutFulfilled(paidSession)
    expect(h.fulfillMarketplaceStripeSession).toHaveBeenCalledTimes(1)
  })
})
