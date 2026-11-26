import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

const findUnique = vi.fn()
const createWebhook = vi.fn()
const updateManyInTx = vi.fn()
const findUniqueInTx = vi.fn()
const scheduleMarketplaceTransferAttempts = vi.fn()
const runProcessTransfersJob = vi.fn()
const ensureMarketplaceCheckoutFulfilled = vi.fn()
const marketplaceCheckoutNeedsFulfillment = vi.fn()
const findOrderIdsForCheckoutSession = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    processedWebhook: { findUnique },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        processedWebhook: {
          findUnique: findUniqueInTx,
          // The processor now writes with upsert (create on first processing, update on a replay) and claims a failed row.
          upsert: createWebhook,
          updateMany: updateManyInTx,
        },
        blindDropshipOrder: { findUnique: vi.fn() },
      }
      await fn(tx)
    },
  },
}))

vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  ensureMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
}))

vi.mock("@/lib/stripe-marketplace-commission-split", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe-marketplace-commission-split")>()
  return {
    ...actual,
    findOrderIdsForCheckoutSession,
  }
})

vi.mock("@/lib/transfers/schedule-from-checkout", () => ({
  scheduleMarketplaceTransferAttempts,
}))

vi.mock("@/lib/transfers/process-transfers", () => ({
  runProcessTransfersJob,
}))

vi.mock("@/lib/stripe-pro", () => ({
  activateProFromCheckoutSession: vi.fn(),
  deactivateProFromSubscription: vi.fn(),
}))

vi.mock("@/lib/stripe-invoice-payment-failed", () => ({
  handleStripeInvoicePaymentFailed: vi.fn(),
}))

vi.mock("@/lib/stripe-charge-refunded", () => ({
  handleStripeChargeRefunded: vi.fn(),
}))

vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn() },
}))

describe("processStripeWebhookEvent idempotence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUnique.mockResolvedValue(null)
    findUniqueInTx.mockResolvedValue(null)
    createWebhook.mockResolvedValue({ id: "evt_1" })
    updateManyInTx.mockResolvedValue({ count: 1 })
    scheduleMarketplaceTransferAttempts.mockResolvedValue({
      orderId: "order_test_1",
      scheduled: true,
    })
    ensureMarketplaceCheckoutFulfilled.mockResolvedValue(undefined)
    marketplaceCheckoutNeedsFulfillment.mockResolvedValue(true)
    findOrderIdsForCheckoutSession.mockResolvedValue(["order_test_1"])
  })

  it("schedules transfers only once when the same event is processed twice", async () => {
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")

    const event = {
      id: "evt_idempotence_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          mode: "payment",
          payment_status: "paid",
          metadata: { orderId: "order_test_1" },
        },
      },
    } as unknown as Stripe.Event

    const r1 = await processStripeWebhookEvent(event)
    expect(r1.duplicate).toBe(false)
    expect(scheduleMarketplaceTransferAttempts).toHaveBeenCalledTimes(1)

    findUnique.mockResolvedValue({
      id: event.id,
      orderId: "order_test_1",
      status: "success",
      error: null,
    })

    const r2 = await processStripeWebhookEvent(event)
    expect(r2.duplicate).toBe(true)
    expect(scheduleMarketplaceTransferAttempts).toHaveBeenCalledTimes(1)
  }, 15_000)

  it("skips ensureMarketplaceCheckoutFulfilled when checkout is already paid", async () => {
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")

    marketplaceCheckoutNeedsFulfillment.mockResolvedValue(false)

    const event = {
      id: "evt_fulfill_skip",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_already_paid",
          mode: "payment",
          payment_status: "paid",
        },
      },
    } as unknown as Stripe.Event

    await processStripeWebhookEvent(event)
    expect(marketplaceCheckoutNeedsFulfillment).toHaveBeenCalledWith("cs_already_paid")
    expect(ensureMarketplaceCheckoutFulfilled).not.toHaveBeenCalled()
  }, 15_000)

  it("does not create orders on payment_intent.succeeded (checkout.session.completed owns fulfill)", async () => {
    const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")

    const event = {
      id: "evt_pi_no_fulfill",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_no_fulfill",
          metadata: { flow: "marketplace" },
        },
      },
    } as unknown as Stripe.Event

    await processStripeWebhookEvent(event)
    expect(ensureMarketplaceCheckoutFulfilled).not.toHaveBeenCalled()
  }, 15_000)

  // Finalisation master doc, D2: a "failed" event must be REPLAYED when Stripe retries it, not swallowed as a duplicate.
  describe("replay of failed events", () => {
    const failedEvent = {
      id: "evt_failed_before",
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_replay", mode: "payment", payment_status: "paid", metadata: { orderId: "order_test_1" } },
      },
    } as unknown as Stripe.Event

    it("processes an event whose previous attempt failed (and records the new outcome)", async () => {
      const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")
      const row = { id: failedEvent.id, orderId: "order_test_1", status: "failed", error: "boom" }
      findUnique.mockResolvedValue(row)
      findUniqueInTx.mockResolvedValue(row)

      const result = await processStripeWebhookEvent(failedEvent)

      expect(result.duplicate).toBe(false)
      expect(scheduleMarketplaceTransferAttempts).toHaveBeenCalledTimes(1)
      // claimed atomically first, then the final status is written by upsert
      expect(updateManyInTx).toHaveBeenCalledWith({
        where: { id: failedEvent.id, status: "failed" },
        data: { status: "processing", error: null },
      })
      expect(createWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: failedEvent.id },
          update: expect.objectContaining({ status: "success" }),
        })
      )
    }, 15_000)

    it.each(["success", "skipped"])("still treats a %s event as a duplicate", async (status) => {
      const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")
      findUnique.mockResolvedValue({ id: failedEvent.id, orderId: "order_test_1", status, error: null })

      const result = await processStripeWebhookEvent(failedEvent)

      expect(result.duplicate).toBe(true)
      expect(scheduleMarketplaceTransferAttempts).not.toHaveBeenCalled()
      expect(updateManyInTx).not.toHaveBeenCalled()
    }, 15_000)

    it("does not process twice when a concurrent retry already claimed the failed event", async () => {
      const { processStripeWebhookEvent } = await import("@/lib/stripe-webhook-processor")
      const row = { id: failedEvent.id, orderId: "order_test_1", status: "failed", error: "boom" }
      findUnique.mockResolvedValue(row)
      findUniqueInTx.mockResolvedValue(row)
      updateManyInTx.mockResolvedValue({ count: 0 }) // the other retry won the row lock

      await processStripeWebhookEvent(failedEvent)

      expect(scheduleMarketplaceTransferAttempts).not.toHaveBeenCalled()
      expect(createWebhook).not.toHaveBeenCalled()
    }, 15_000)
  })
})
