import { beforeEach, describe, expect, it, vi } from "vitest"

import { openDisputeHold } from "@/lib/orders/dispute-hold.server"
import { createFakeProcessedWebhook } from "@/lib/testing/fake-processed-webhook"

/**
 * Finalisation review C3: the dispute ledger lives in `ProcessedWebhook` (rows `dispute:<dp>:<order>`, same `orderId`
 * column). A dispute that opens AFTER a failed checkout webhook made its ledger row the newest row of the order, so the
 * "latest webhook per order" of the admin Stripe-health page and of the stripe-health cron stopped showing the failure.
 */

const ledger = createFakeProcessedWebhook()
const orderRow = {
  id: "ord_1",
  customerEmail: "b@example.test",
  totalCents: 12_000,
  sellingPriceCents: 10_000,
  createdAt: new Date("2026-11-10T10:00:00Z"),
  status: "paid",
  splitStatus: "PENDING",
  paymentSettlementStatus: "PAID",
  supplierPayoutCents: 0,
  affiliatePayoutCents: 0,
  affiliateStripeAccountId: null,
  supplier: { stripeAccountId: "acct_sup", stripeOnboardedAt: new Date() },
  affiliate: { stripeAccountId: "acct_aff", stripeOnboardedAt: new Date() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: async () => [orderRow] },
    processedWebhook: {
      findMany: (...a: unknown[]) => (ledger.delegate.findMany as (...x: unknown[]) => unknown)(...a),
    },
  },
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn() }))

import { loadStripeHealthOrders } from "@/lib/admin/stripe-health/load-orders"
import { findStuckStripeHealthOrders } from "@/lib/cron/stripe-health"

beforeEach(() => {
  ledger.rows.clear()
  // the checkout webhook FAILED earlier...
  ledger.rows.set("evt_checkout", {
    id: "evt_checkout",
    orderId: "ord_1",
    status: "failed",
    error: "boom",
    createdAt: new Date("2026-11-10T10:01:00Z"),
  })
})

async function openDispute() {
  await openDisputeHold(
    { processedWebhook: { ...ledger.delegate, findUnique: ledger.delegate.findUnique } } as never,
    { disputeId: "dp_1", orderId: "ord_1", previousStatus: "paid" }
  )
  // ...and the dispute opens LATER: its ledger row is the newest row of the order
  const row = ledger.rows.get("dispute:dp_1:ord_1")!
  row.createdAt = new Date("2026-11-12T10:00:00Z")
}

describe("the dispute ledger never hides a failed checkout webhook (review C3)", () => {
  it("admin Stripe-health page: the failed webhook is still the latest webhook of the order", async () => {
    await openDispute()
    expect(ledger.rows.get("dispute:dp_1:ord_1")?.status).toBe("dispute_open")

    const [row] = await loadStripeHealthOrders()

    expect(row?.webhookEventId).toBe("evt_checkout")
    expect(row?.webhookStatus).toBe("failed")
    expect(row?.stripeHealthStatus).toBe("split_failed")
  })

  it("stripe-health cron: the stuck order still reports the failed webhook, not the ledger row", async () => {
    await openDispute()

    const stuck = await findStuckStripeHealthOrders(1)

    expect(stuck).toHaveLength(1)
    expect(stuck[0]).toMatchObject({ orderId: "ord_1", webhookStatus: "failed", webhookError: "boom" })
  })

  it("without a dispute nothing changes", async () => {
    const [row] = await loadStripeHealthOrders()
    expect(row?.webhookStatus).toBe("failed")
  })
})
