import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

const findUnique = vi.fn()
const upsertInTx = vi.fn()
const findUniqueInTx = vi.fn()
const updateManyInTx = vi.fn()
const processStripeDisputeEvent = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    processedWebhook: { findUnique: (...a: unknown[]) => findUnique(...a), upsert: vi.fn() },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        processedWebhook: {
          findUnique: (...a: unknown[]) => findUniqueInTx(...a),
          upsert: (...a: unknown[]) => upsertInTx(...a),
          updateMany: (...a: unknown[]) => updateManyInTx(...a),
        },
      }
      await fn(tx)
    },
  },
}))
vi.mock("@/lib/stripe-dispute", () => ({
  processStripeDisputeEvent: (...a: unknown[]) => processStripeDisputeEvent(...a),
}))
vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  ensureMarketplaceCheckoutFulfilled: vi.fn(),
  marketplaceCheckoutNeedsFulfillment: vi.fn(),
}))
vi.mock("@/lib/transfers/schedule-from-checkout", () => ({ scheduleMarketplaceTransferAttempts: vi.fn() }))
vi.mock("@/lib/stripe-pro", () => ({
  activateProFromCheckoutSession: vi.fn(),
  deactivateProFromSubscription: vi.fn(),
  syncProFromSubscriptionUpdate: vi.fn(),
}))
vi.mock("@/lib/stripe-invoice-payment-failed", () => ({ handleStripeInvoicePaymentFailed: vi.fn() }))
vi.mock("@/lib/stripe-charge-refunded", () => ({ handleStripeChargeRefunded: vi.fn() }))
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }))

function disputeEvent(type: string, id = "evt_dp_1"): Stripe.Event {
  return {
    id,
    type,
    data: { object: { id: "dp_1", status: "needs_response", amount: 12_000, currency: "eur", charge: "ch_1" } },
  } as unknown as Stripe.Event
}

describe("processStripeWebhookEvent — charge.dispute.* (D7)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUnique.mockResolvedValue(null)
    findUniqueInTx.mockResolvedValue(null)
    upsertInTx.mockResolvedValue({})
    updateManyInTx.mockResolvedValue({ count: 1 })
    processStripeDisputeEvent.mockResolvedValue({ orderId: "ord_1", status: "success", error: null })
  })

  it.each([
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
    "charge.dispute.funds_withdrawn",
    "charge.dispute.funds_reinstated",
  ])("%s is handled (it used to answer 'skipped')", async (type) => {
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")
    const event = disputeEvent(type)

    const result = await processStripeWebhookEvent(event)

    expect(processStripeDisputeEvent).toHaveBeenCalledTimes(1)
    expect(processStripeDisputeEvent.mock.calls[0]?.[0]).toBe(event)
    expect(result).toMatchObject({ handled: true, duplicate: false, status: "success", orderId: "ord_1" })
    expect(upsertInTx).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ id: "evt_dp_1", status: "success", orderId: "ord_1" }) })
    )
  }, 15_000)

  it("records a dispute the handler could not attribute as skipped (not as a failure to replay forever)", async () => {
    processStripeDisputeEvent.mockResolvedValue({ orderId: null, status: "skipped", error: "orders_not_found" })
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")
    const result = await processStripeWebhookEvent(disputeEvent("charge.dispute.created"))
    expect(result.status).toBe("skipped")
    expect(upsertInTx).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "skipped", error: "orders_not_found" }) })
    )
  }, 15_000)

  it("a handler failure is recorded as failed, so Stripe's retry and the replay job process the event again", async () => {
    processStripeDisputeEvent.mockRejectedValue(new Error("stripe down"))
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")

    const result = await processStripeWebhookEvent(disputeEvent("charge.dispute.closed"))

    expect(result.status).toBe("failed")
    expect(upsertInTx).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "failed", error: "stripe down" }) })
    )
  }, 15_000)

  it("replays a failed dispute event instead of answering 'duplicate'", async () => {
    findUnique.mockResolvedValue({ id: "evt_dp_1", orderId: null, status: "failed", error: "stripe down" })
    findUniqueInTx.mockResolvedValue({ id: "evt_dp_1", orderId: null, status: "failed", error: "stripe down" })
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")

    const result = await processStripeWebhookEvent(disputeEvent("charge.dispute.closed"))

    expect(result.duplicate).toBe(false)
    expect(processStripeDisputeEvent).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
  }, 15_000)

  it("an already successful dispute event is a duplicate and is not applied twice", async () => {
    findUnique.mockResolvedValue({ id: "evt_dp_1", orderId: "ord_1", status: "success", error: null })
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")
    const result = await processStripeWebhookEvent(disputeEvent("charge.dispute.closed"))
    expect(result.duplicate).toBe(true)
    expect(processStripeDisputeEvent).not.toHaveBeenCalled()
  }, 15_000)
})
