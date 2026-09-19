import { beforeEach, describe, expect, it, vi } from "vitest"

const transfersCreate = vi.fn(async () => ({ id: "tr_new" }))
const state: { attempt: Record<string, unknown>; others: Array<{ amountCents: number }> } = {
  attempt: {},
  others: [],
}
const updates: Array<Record<string, unknown>> = []

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe-webhook-observability", () => ({
  logStripeWebhookInfo: vi.fn(),
  logStripeWebhookError: vi.fn(),
}))
vi.mock("@/lib/order-transfer-gating", () => ({
  evaluateTransferReleaseForRole: () => ({ eligible: true }),
}))
vi.mock("@/lib/payout-settlement", () => ({
  marketplaceRoleAlreadySettled: async () => false,
  recordStripePayoutSettlement: vi.fn(async () => true),
  supersedePendingTransferAttempt: vi.fn(async () => {}),
}))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    accounts: { retrieve: async () => ({ capabilities: { transfers: "active" } }) },
    transfers: { create: transfersCreate },
  }),
}))
vi.mock("@/lib/prisma", () => {
  const prisma = {
    transferAttempt: {
      findUnique: async () => state.attempt,
      findMany: async (args: { where?: { status?: string } }) =>
        args.where?.status === "SUCCESS" ? state.others : [],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data)
        return {}
      },
    },
    order: {
      findUnique: async () => ({ transferAttempts: [], product: { name: "x" } }),
      update: async () => ({}),
      findMany: async () => [],
    },
    user: { updateMany: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  }
  return { prisma }
})

import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"

function attempt(over: Partial<Record<string, unknown>> = {}, orderOver: Record<string, unknown> = {}) {
  return {
    id: "att_1",
    orderId: "ord_1",
    role: "AFFILIATE",
    amountCents: 3200,
    destination: "acct_aff",
    status: "PENDING",
    attempts: 0,
    order: {
      status: "paid",
      payoutStatus: "PENDING",
      subtotalCents: 13_000,
      sellingPriceCents: 13_000,
      basePriceCents: 10_000,
      supplierPriceCents: 10_000,
      affiliateMarginCents: 3000,
      stripeChargeId: "ch_1",
      supplierId: "sup",
      affiliateId: "aff",
      product: { name: "Widget" },
      returns: [],
      autoBuyLog: null,
      supplierFulfillmentLinks: [],
      ...orderOver,
    },
    ...over,
  }
}

async function runOnce(att: ReturnType<typeof attempt>) {
  state.attempt = att as never
  const { prisma } = await import("@/lib/prisma")
  ;(prisma.transferAttempt as unknown as { findMany: unknown }).findMany = async (args: { where?: { status?: string; attempts?: unknown } }) =>
    args.where?.status === "SUCCESS" ? state.others : [{ id: "att_1" }]
  return runProcessTransfersJob({ orderId: "ord_1" })
}

describe("runProcessTransfersJob — last-line money guard", () => {
  beforeEach(() => {
    transfersCreate.mockClear()
    updates.length = 0
    state.others = []
    delete process.env.MONEY_GUARD_MODE
  })

  it("sends a normal transfer with a stable idempotency key", async () => {
    await runOnce(attempt())
    expect(transfersCreate).toHaveBeenCalledTimes(1)
    const [params, opts] = transfersCreate.mock.calls[0] as unknown as [Record<string, unknown>, { idempotencyKey: string }]
    expect(params).toMatchObject({ amount: 3200, destination: "acct_aff", currency: "eur" })
    expect(opts.idempotencyKey).toBe("transfer_ord_1_AFFILIATE")
  })

  it("never calls Stripe when payouts would exceed the undiscounted price", async () => {
    state.others = [{ amountCents: 9500 }]
    await runOnce(attempt({ amountCents: 4500 })) // 9500 + 4500 = 14000 > 10000 + 3000
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(updates.some((u) => u.status === "FAILED" && u.errorCode === "PAYOUT_EXCEEDS_LINE")).toBe(true)
  })

  it("still pays a discounted sale (collected below the list price) up to the list price", async () => {
    await runOnce(attempt({ amountCents: 3200 }, { subtotalCents: 6500, sellingPriceCents: 6500 }))
    expect(transfersCreate).toHaveBeenCalledTimes(1)
  })

  it("only monitors when explicitly opted out", async () => {
    process.env.MONEY_GUARD_MODE = "monitor"
    state.others = [{ amountCents: 9500 }]
    await runOnce(attempt({ amountCents: 4500 }))
    expect(transfersCreate).toHaveBeenCalledTimes(1)
  })
})
