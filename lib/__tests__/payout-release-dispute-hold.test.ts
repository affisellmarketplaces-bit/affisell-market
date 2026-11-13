import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Finalisation master doc, D7: the two OTHER payout releases (Lightning instant payout, Légion 2% override) must also
 * refuse while a dispute is open. `process-transfers` is covered in process-transfers-money-guard.test.ts.
 */

const state = { openHolds: 0, order: {} as Record<string, unknown> }
const transfersCreate = vi.fn(async (..._args: unknown[]) => ({ id: "tr_x" }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: async () => state.order,
      updateMany: async () => ({ count: 1 }),
    },
    processedWebhook: { count: async () => state.openHolds },
    supplierProfile: { findUnique: async () => ({ trustScore: 90, lightningEnabled: true, lightningAdminOverride: false }) },
    user: { findUnique: async () => ({ stripeAccountId: "acct_x" }) },
    legionReferral: { findFirst: async () => null },
  },
}))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: async () => ({ status: "succeeded", latest_charge: "ch_1" }) },
    transfers: { create: (...a: unknown[]) => transfersCreate(...a) },
  }),
}))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({ assertTransfersActive: async () => {} }))
vi.mock("@/lib/payout-settlement", () => ({
  recordStripePayoutSettlement: vi.fn(),
  supersedePendingTransferAttempt: vi.fn(),
}))

import { payLegionOverrideForOrder } from "@/lib/legion/pay-referral-override"
import { triggerLightningPayout } from "@/lib/stripe-lightning"

describe("Lightning instant payout", () => {
  beforeEach(() => {
    transfersCreate.mockClear()
    state.openHolds = 0
    state.order = {
      id: "ord_1",
      supplierId: "sup",
      affiliateId: "aff",
      productId: "p",
      status: "shipped",
      payoutStatus: "PENDING",
      supplierPayoutCents: 5_000,
      affiliatePayoutCents: 2_000,
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
      currency: "EUR",
      product: { name: "Widget" },
    }
  })

  it("refuses while a dispute is open in the ledger, even if the status says shipped", async () => {
    state.openHolds = 1
    expect(await triggerLightningPayout("ord_1")).toEqual({ success: false, reason: "dispute_open" })
    expect(transfersCreate).not.toHaveBeenCalled()
  })

  it("refuses a disputed status even with no ledger row", async () => {
    state.order = { ...state.order, status: "disputed" }
    expect(await triggerLightningPayout("ord_1")).toEqual({ success: false, reason: "dispute_open" })
    expect(transfersCreate).not.toHaveBeenCalled()
  })

  it("a ledger read error is a refusal, never a payout", async () => {
    const { prisma } = await import("@/lib/prisma")
    const original = (prisma as unknown as { processedWebhook: { count: unknown } }).processedWebhook.count
    ;(prisma as unknown as { processedWebhook: { count: unknown } }).processedWebhook.count = async () => {
      throw new Error("db down")
    }
    try {
      const result = await triggerLightningPayout("ord_1")
      expect(result.success).toBe(false)
      expect(transfersCreate).not.toHaveBeenCalled()
    } finally {
      ;(prisma as unknown as { processedWebhook: { count: unknown } }).processedWebhook.count = original
    }
  })

  it("is not blocked when no dispute is open (the guard does not break the normal path)", async () => {
    const result = await triggerLightningPayout("ord_1")
    expect(result.success === false && result.reason === "dispute_open").toBe(false)
  })

  // Finalisation review #8: after a LOST dispute the ledger row is terminal and the order is refunded, but its
  // `payoutStatus` is still PENDING: only the closed-order rule stops the AfterShip "delivered" webhook from paying it.
  it.each([
    ["refunded", { status: "refunded", paymentSettlementStatus: "REFUNDED" }],
    ["lost dispute with a clawback still pending", { status: "disputed", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" }],
    ["lost dispute, status left as it was", { status: "shipped", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" }],
    ["cancelled", { status: "CANCELLED", paymentSettlementStatus: "CANCELLED" }],
    ["stale paid status, REFUNDED settlement", { status: "paid", paymentSettlementStatus: "REFUNDED" }],
  ])("refuses a closed order (%s) — no transfer, even with no open dispute", async (_label, over) => {
    state.openHolds = 0
    state.order = { ...state.order, ...over }
    expect(await triggerLightningPayout("ord_1")).toEqual({ success: false, reason: "order_closed" })
    expect(transfersCreate).not.toHaveBeenCalled()
  })
})

describe("Légion override payout", () => {
  beforeEach(() => {
    transfersCreate.mockClear()
    state.openHolds = 0
    state.order = {
      id: "ord_1",
      storeProfileId: "sp_1",
      legionOverrideAmount: 2,
      legionPayoutStatus: "reserved",
      stripeChargeId: "ch_1",
      status: "shipped",
    }
  })

  it("does not pay while a dispute is open", async () => {
    state.openHolds = 1
    expect(await payLegionOverrideForOrder("ord_1")).toEqual({ paid: false, transferId: null, reason: "dispute_open" })
    expect(transfersCreate).not.toHaveBeenCalled()
  })

  it("does not pay a disputed order", async () => {
    state.order = { ...state.order, status: "disputed" }
    expect(await payLegionOverrideForOrder("ord_1")).toEqual({ paid: false, transferId: null, reason: "dispute_open" })
  })

  it("carries on to the normal checks when no dispute is open", async () => {
    // no active referral in the fake: the normal path stops there, i.e. AFTER the dispute guard
    expect(await payLegionOverrideForOrder("ord_1")).toMatchObject({ paid: false, reason: "sponsor_connect_missing" })
  })

  // Finalisation review #8: the catch-up of process-transfers pays `reserved` overrides of orders whose affiliate leg
  // settled; after a reversal that is still true, so the closed-order rule is what stops the 2% override.
  it.each([
    ["refunded", { status: "refunded", paymentSettlementStatus: "REFUNDED" }],
    ["lost dispute with a clawback still pending", { status: "shipped", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" }],
    ["cancelled", { status: "cancelled" }],
  ])("does not pay the override of a closed order (%s)", async (_label, over) => {
    state.order = { ...state.order, ...over }
    expect(await payLegionOverrideForOrder("ord_1")).toEqual({ paid: false, transferId: null, reason: "order_closed" })
    expect(transfersCreate).not.toHaveBeenCalled()
  })
})
