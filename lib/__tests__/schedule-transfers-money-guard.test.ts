import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_test" }) },
  }),
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/stripe-webhook-observability", () => ({
  logStripeWebhookInfo: vi.fn(),
  logStripeWebhookError: vi.fn(),
}))

import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"

type Attempt = {
  orderId: string
  role: "SUPPLIER" | "AFFILIATE"
  amountCents: number
  destination: string
  status: "PENDING" | "SUCCESS" | "FAILED"
  attempts: number
  errorCode?: string | null
  stripeTransferId?: string | null
}

function fakeDb(order: Record<string, unknown>, attempts: Attempt[] = []) {
  const state = { order: { ...order }, attempts: [...attempts] }
  const db = {
    order: {
      findUnique: async () => ({
        ...state.order,
        supplier: { stripeAccountId: "acct_sup" },
        affiliate: { stripeAccountId: "acct_aff" },
        transferAttempts: state.attempts,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.order = { ...state.order, ...data }
      },
    },
    transferAttempt: {
      upsert: async ({ create, update, where }: { create: Attempt; update: Partial<Attempt>; where: { orderId_role: { role: Attempt["role"] } } }) => {
        const i = state.attempts.findIndex((a) => a.role === where.orderId_role.role)
        if (i >= 0) state.attempts[i] = { ...state.attempts[i]!, ...update } as Attempt
        else state.attempts.push(create)
      },
      findMany: async () => state.attempts,
    },
  }
  return { db, state }
}

const session = { id: "cs_test_1", payment_intent: "pi_1" } as never

const healthyOrder = {
  id: "ord_1",
  basePriceCents: 9508,
  sellingPriceCents: 14832,
  subtotalCents: 14832,
  taxCents: 2966,
  totalCents: 17798,
  commissionCents: 951,
  affiliatePayoutCents: 951,
  supplierPriceCents: 9508,
  supplierCommissionRateBps: 1000,
  affisellCommissionRateBps: 1000,
  supplierFeeCents: 951,
  affiliateFeeCents: 1255,
  affisellFeeCents: 2206,
  affiliateMarginCents: 5324,
  affiliateMarginRetainedCents: 5324,
  usesAffisellAutoBuy: false,
  aeWholesaleCents: null,
  supplierPayoutCents: 7606,
  supplierMarginCents: 7606,
  upstreamCogsCents: null,
  paidAt: new Date("2026-06-29"),
  shipDeadlineAt: null,
  stripeSessionId: "cs_test_1",
  stripeChargeId: null,
  affiliateStripeAccountId: null,
}

describe("scheduleMarketplaceTransferAttempts — money guard", () => {
  beforeEach(() => {
    delete process.env.MONEY_GUARD_MODE
  })

  it("schedules the exact legs and keeps the VAT-inclusive total", async () => {
    const { db, state } = fakeDb(healthyOrder)
    const res = await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    expect(res.scheduled).toBe(true)
    const byRole = Object.fromEntries(state.attempts.map((a) => [a.role, a]))
    expect(byRole.SUPPLIER!.amountCents).toBe(7606)
    expect(byRole.AFFILIATE!.amountCents).toBe(951 + 5324 - 1255)
    expect(byRole.SUPPLIER!.status).toBe("PENDING")
    expect(state.order.totalCents).toBe(17798)
  })

  it("is idempotent: a second run after the write-back never inflates the affiliate leg", async () => {
    const { db, state } = fakeDb(healthyOrder)
    await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    const first = state.attempts.map((a) => ({ role: a.role, amount: a.amountCents }))
    // Real pipeline: the first run wrote the NET affiliate transfer into affiliatePayoutCents.
    expect(state.order.affiliatePayoutCents).toBe(5020)
    await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    expect(state.attempts.map((a) => ({ role: a.role, amount: a.amountCents }))).toEqual(first)
    const total = state.attempts.reduce((s, a) => s + a.amountCents, 0)
    expect(total).toBeLessThanOrEqual(14832)
  })

  it("blocks a corrupted snapshot whose payouts exceed the undiscounted price", async () => {
    // Stale supplierMarginCents (e.g. from an earlier buggy run) would pay the supplier 30 000.
    const { db, state } = fakeDb({ ...healthyOrder, supplierMarginCents: 30_000 })
    const res = await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    expect(res).toMatchObject({ scheduled: false, reason: "payout_exceeds_line" })
    expect(state.attempts.every((a) => a.status === "FAILED" && a.errorCode === "PAYOUT_EXCEEDS_LINE")).toBe(true)
    expect(state.attempts.some((a) => a.status === "PENDING")).toBe(false)
  })

  it("still pays a heavily discounted sale in full (the platform funds the discount)", async () => {
    // Flash sale: 50% off → collected 7 416 while partners keep their full shares.
    const { db, state } = fakeDb({
      ...healthyOrder,
      sellingPriceCents: 7416,
      subtotalCents: 7416,
      taxCents: 1483,
      totalCents: 8899,
    })
    const res = await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    expect(res.scheduled).toBe(true)
    expect(state.attempts.every((a) => a.status === "PENDING")).toBe(true)
  })

  it("only monitors when explicitly opted out", async () => {
    process.env.MONEY_GUARD_MODE = "monitor"
    const { db, state } = fakeDb({ ...healthyOrder, subtotalCents: 5000, sellingPriceCents: 5000, taxCents: 0, totalCents: 5000 })
    const res = await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    expect(res.scheduled).toBe(true)
    expect(state.attempts.every((a) => a.status === "PENDING")).toBe(true)
  })

  it("never re-plans a leg that already succeeded", async () => {
    const { db, state } = fakeDb(healthyOrder, [
      { orderId: "ord_1", role: "SUPPLIER", amountCents: 7606, destination: "acct_sup", status: "SUCCESS", attempts: 1, stripeTransferId: "tr_1" },
    ])
    await scheduleMarketplaceTransferAttempts(session, "ord_1", db as never)
    const sup = state.attempts.find((a) => a.role === "SUPPLIER")!
    expect(sup.status).toBe("SUCCESS")
    expect(sup.stripeTransferId).toBe("tr_1")
  })
})
