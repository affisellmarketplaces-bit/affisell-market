import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

import { createFakeProcessedWebhook } from "@/lib/testing/fake-processed-webhook"

/**
 * Finalisation review #7: a LOST dispute on a SPONSORED order used to block the webhook transaction on itself.
 * `processStripeDisputeEvent` runs inside the webhook's interactive transaction; `tx.order.update` takes the Order row's
 * lock and keeps it until the event is done, and the (real) sponsor fee reversal then updated the SAME row through the
 * global Prisma client — another connection, waiting for the lock held by the transaction that was awaiting it.
 *
 * The fake models exactly that: a write through the transaction locks the row, a write to a locked row through the global
 * client can never complete (here it throws "BLOCKED" so the test fails fast instead of hanging for 25 s). The real
 * `reverseSponsorSuccessFeesForOrder` runs; everything else around it is faked.
 */

const locks = new Set<string>()
const orderRow: Record<string, unknown> & { id: string } = {
  id: "ord_s",
  status: "shipped",
  paymentSettlementStatus: "PAID",
  shippedAt: new Date("2026-06-01"),
  trackingNumber: "TRK1",
  supplierPreparingAt: null,
  totalCents: 12_000,
  subtotalCents: 10_000,
  sellingPriceCents: 10_000,
  platformCommissionCents: 1_200,
  taxCents: 2_000,
  currency: "EUR",
  stripeChargeId: "ch_1",
  stripePaymentIntentId: "pi_1",
  stripeSessionId: "cs_1",
  affisellFeeCents: 2_000,
}
const charge = { id: "sc_1", campaignId: "camp_1", feeCents: 500, reversedCents: 0, status: "ACCRUED" }
const calls = {
  globalOrderUpdates: [] as Array<Record<string, unknown>>,
  campaignDecrements: [] as number[],
  txOrderUpdates: [] as Array<Record<string, unknown>>,
}
const ledger = createFakeProcessedWebhook()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: async () => [{ ...orderRow }],
      findUnique: async () => ({ affisellFeeCents: orderRow.affisellFeeCents }),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (locks.has(where.id)) {
          throw new Error("BLOCKED: global-client write to an Order row locked by the open webhook transaction")
        }
        calls.globalOrderUpdates.push(data)
        Object.assign(orderRow, data)
        return orderRow
      },
    },
    orderStripeRefund: { findUnique: async () => null, create: async () => ({}) },
    sponsorCampaignCharge: {
      findMany: async () => (charge.status === "ACCRUED" || charge.reversedCents > 0 ? [{ ...charge }] : []),
      updateMany: async ({ data }: { data: { reversedCents: number; status: string } }) => {
        charge.reversedCents = data.reversedCents
        charge.status = data.status
        return { count: 1 }
      },
    },
    sponsorCampaign: {
      update: async ({ data }: { data: { accruedFeeCents: { decrement: number } } }) => {
        calls.campaignDecrements.push(data.accruedFeeCents.decrement)
        return {}
      },
    },
    processedWebhook: { findUnique: (...a: unknown[]) => (ledger.delegate.findUnique as (...x: unknown[]) => unknown)(...a) },
  },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ checkout: { sessions: { list: async () => ({ data: [] }) } } }) }))
vi.mock("@/lib/stripe-transfer-reversal", () => ({ reverseConnectTransfersForRefund: vi.fn(async () => ({ outcomes: [], attemptedReversalCount: 0 })) }))
vi.mock("@/lib/payout-reversal-safety", () => ({
  evaluateClawbackSafety: vi.fn(async () => ({ allowed: true, reason: "no_stripe_transfers", pendingClawback: false })),
  markRefundPendingClawback: vi.fn(),
  alertClawbackBlocked: vi.fn(),
}))
vi.mock("@/lib/order-payout", () => ({ clawbackOrderPayoutsOnRefund: vi.fn(async () => ({ executed: true })) }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => ({ slack: false, discord: false })) }))
vi.mock("@/lib/fulfillment/external-order-cancellation", () => ({ attemptExternalOrderCancellation: vi.fn(async () => ({ outcome: "not_applicable" })) }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))

import { processStripeDisputeEvent } from "@/lib/stripe-dispute"

/** The webhook transaction: its Order writes take the row lock, which is released only when the "transaction" ends. */
function webhookTransaction() {
  return {
    order: {
      findMany: async () => [{ ...orderRow }],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        locks.add(where.id)
        calls.txOrderUpdates.push(data)
        Object.assign(orderRow, data)
        return orderRow
      },
    },
    processedWebhook: ledger.delegate,
  } as never
}

const lostDispute = {
  id: "dp_s",
  amount: 12_000,
  currency: "eur",
  charge: "ch_1",
  payment_intent: "pi_1",
  reason: "fraudulent",
  status: "lost",
} as unknown as Stripe.Dispute

beforeEach(() => {
  locks.clear()
  ledger.rows.clear()
  calls.globalOrderUpdates.length = 0
  calls.campaignDecrements.length = 0
  calls.txOrderUpdates.length = 0
  Object.assign(orderRow, { status: "shipped", paymentSettlementStatus: "PAID", affisellFeeCents: 2_000 })
  Object.assign(charge, { reversedCents: 0, status: "ACCRUED" })
})

describe("lost dispute on a sponsored order (review #7)", () => {
  it("reverses the sponsor fee through the global client WITHOUT ever waiting on the transaction's own Order lock", async () => {
    const tx = webhookTransaction()
    const event = { id: "evt_1", type: "charge.dispute.closed", data: { object: lostDispute } } as unknown as Stripe.Event

    const result = await processStripeDisputeEvent(event, tx)
    locks.clear() // the transaction commits

    expect(result.status).toBe("success")
    // the sponsor fee WAS given back: the global write to the Order row happened (it would have been BLOCKED otherwise)
    expect(charge.status).toBe("REVERSED")
    expect(calls.campaignDecrements).toEqual([500])
    expect(calls.globalOrderUpdates).toEqual([{ affisellFeeCents: 1_500 }])
    // and the transaction's own write still lands, last
    expect(calls.txOrderUpdates).toEqual([{ paymentSettlementStatus: "REFUNDED", status: "refunded" }])
    expect(orderRow).toMatchObject({ status: "refunded", paymentSettlementStatus: "REFUNDED", affisellFeeCents: 1_500 })
  })

  it("the Order row is locked only at the very end of the per-order work", async () => {
    const order: string[] = []
    const tx = webhookTransaction() as unknown as { order: { update: (a: never) => Promise<unknown> } }
    const originalUpdate = tx.order.update
    tx.order.update = async (args) => {
      order.push(`tx-update(sponsor reversed: ${charge.status === "REVERSED"})`)
      return originalUpdate(args)
    }
    await processStripeDisputeEvent({ id: "evt_2", type: "charge.dispute.closed", data: { object: lostDispute } } as unknown as Stripe.Event, tx as never)
    expect(order).toEqual(["tx-update(sponsor reversed: true)"])
  })

  it("an order with no sponsor charge is unaffected", async () => {
    charge.status = "REVERSED"
    charge.reversedCents = 500
    const result = await processStripeDisputeEvent(
      { id: "evt_3", type: "charge.dispute.closed", data: { object: lostDispute } } as unknown as Stripe.Event,
      webhookTransaction()
    )
    expect(result.status).toBe("success")
    expect(calls.globalOrderUpdates).toEqual([])
    expect(orderRow.status).toBe("refunded")
  })
})
