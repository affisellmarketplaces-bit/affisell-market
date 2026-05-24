import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

const findUnique = vi.fn()
const createWebhook = vi.fn()
const findUniqueInTx = vi.fn()
const scheduleMarketplaceTransferAttempts = vi.fn()
const runProcessTransfersJob = vi.fn()
const ensureMarketplaceCheckoutFulfilled = vi.fn()
const findOrderIdsForCheckoutSession = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    processedWebhook: { findUnique },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        processedWebhook: {
          findUnique: findUniqueInTx,
          create: createWebhook,
        },
        blindDropshipOrder: { findUnique: vi.fn() },
      }
      await fn(tx)
    },
  },
}))

vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  ensureMarketplaceCheckoutFulfilled,
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
    scheduleMarketplaceTransferAttempts.mockResolvedValue({
      orderId: "order_test_1",
      scheduled: true,
    })
    ensureMarketplaceCheckoutFulfilled.mockResolvedValue(undefined)
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
  })
})
