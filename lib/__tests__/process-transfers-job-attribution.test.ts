/**
 * Payout gate ↔ engine-job attribution (#4): a supplier transfer is released only when the order's upstream is funded. An
 * AliExpress job buys its FIRST line only, so the second order of a cart must not be read as "funded" on the strength of the
 * first one's job. (Stripe is mocked: nothing real moves.)
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  attempt: {} as Record<string, unknown>,
  gateArgs: [] as Array<Record<string, unknown>>,
}))

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe-webhook-observability", () => ({ logStripeWebhookInfo: vi.fn(), logStripeWebhookError: vi.fn() }))
vi.mock("@/lib/order-transfer-gating", () => ({
  evaluateTransferReleaseForRole: (_role: string, snapshot: Record<string, unknown>) => {
    h.gateArgs.push(snapshot)
    return { eligible: false, phase: "awaiting_upstream", reason: "test" }
  },
}))
vi.mock("@/lib/payout-settlement", () => ({
  marketplaceRoleAlreadySettled: async () => false,
  recordStripePayoutSettlement: vi.fn(async () => true),
  supersedePendingTransferAttempt: vi.fn(async () => {}),
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({}) }))
vi.mock("@/lib/prisma", () => {
  const prisma = {
    transferAttempt: {
      findUnique: async () => h.attempt,
      findMany: async () => [{ id: "att_1" }],
      update: async () => ({}),
    },
    order: { findUnique: async () => ({ transferAttempts: [], product: { name: "x" } }), update: async () => ({}), findMany: async () => [] },
    processedWebhook: { count: async () => 0 },
    user: { updateMany: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  }
  return { prisma }
})

import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"

const job = (channelType: string, firstLineOrderId: string) => ({
  supplierFulfillmentOrder: {
    status: "CONFIRMED",
    provider: { channelType },
    lines: [{ orderId: firstLineOrderId }],
  },
})

function attemptFor(orderId: string, links: unknown[]) {
  return {
    id: "att_1",
    orderId,
    role: "SUPPLIER",
    amountCents: 1000,
    destination: "acct_sup",
    status: "PENDING",
    attempts: 0,
    order: {
      status: "paid",
      payoutStatus: "PENDING",
      usesAffisellAutoBuy: true,
      fulfillmentStatus: "PROCESSING",
      product: { name: "Widget" },
      returns: [],
      autoBuyLog: null,
      supplierFulfillmentLinks: links,
    },
  }
}

async function statusesSeenByTheGate(orderId: string, links: unknown[]): Promise<string[]> {
  h.gateArgs.length = 0
  h.attempt = attemptFor(orderId, links)
  await runProcessTransfersJob({ orderId })
  return h.gateArgs[0]!.supplierJobStatuses as string[]
}

beforeEach(() => {
  h.gateArgs.length = 0
})

describe("payout gate — which jobs count as 'upstream funded' for THIS order", () => {
  it("the FIRST line of an AliExpress job: its job counts", async () => {
    expect(await statusesSeenByTheGate("order_A", [job("ALIEXPRESS", "order_A")])).toEqual(["CONFIRMED"])
  })

  it("the SECOND line of the same AliExpress job: it was never bought, its job must NOT count", async () => {
    expect(await statusesSeenByTheGate("order_B", [job("ALIEXPRESS", "order_A")])).toEqual([])
  })

  it("a CJ / blind-REST job covers every line: it counts for the second order too", async () => {
    expect(await statusesSeenByTheGate("order_B", [job("CJ_DROPSHIPPING", "order_A")])).toEqual(["CONFIRMED"])
    expect(await statusesSeenByTheGate("order_B", [job("BLIND_REST", "order_A")])).toEqual(["CONFIRMED"])
  })
})
