import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A3 hotfix on the production branch (2026-11-25): Lightning never pays a leg that shows a payment trace, claims the order
 * before Stripe, shares process-transfers' idempotency key, records each leg at once, and keeps an uncertain order
 * PROCESSING. In-memory database + fake Stripe; the real settlement recorder is replaced by a recorder of calls.
 */
type Attempt = { orderId: string; role: "SUPPLIER" | "AFFILIATE"; status: string; stripeTransferId: string | null; amountCents: number }
const db = vi.hoisted(() => ({
  order: null as null | Record<string, unknown>,
  attempts: [] as Array<{ orderId: string; role: string; status: string; stripeTransferId: string | null; amountCents: number }>,
  ledger: [] as Array<{ orderId: string; stripeTransferId: string }>,
  recordFails: false,
}))
const stripeCalls = vi.hoisted(() => ({ create: [] as Array<{ params: Record<string, unknown>; key: string }>, plan: [] as Array<"ok" | Error> }))
const alerts = vi.hoisted(() => ({ list: [] as string[] }))

vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: async (t: string) => { alerts.list.push(t); return { slack: false, discord: false } } }))
vi.mock("@/lib/legion/pay-referral-override", () => ({ payLegionOverrideForOrder: async () => ({ paid: false }) }))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({ assertTransfersActive: async () => {} }))
vi.mock("@/lib/payout-settlement", () => ({
  recordStripePayoutSettlement: async (_tx: unknown, a: { orderId: string; stripeTransferId: string }) => {
    if (db.recordFails) throw new Error("db down")
    db.ledger.push({ orderId: a.orderId, stripeTransferId: a.stripeTransferId })
    return true
  },
}))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: async () => ({ status: "succeeded", latest_charge: "ch_1" }) },
    transfers: {
      create: async (params: Record<string, unknown>, opts: { idempotencyKey: string }) => {
        stripeCalls.create.push({ params, key: opts.idempotencyKey })
        const next = stripeCalls.plan.shift() ?? "ok"
        if (next instanceof Error) throw next
        return { id: `tr_${stripeCalls.create.length}` }
      },
    },
  }),
}))
vi.mock("@/lib/prisma", () => {
  const prisma = {
    order: {
      findUnique: async () => db.order,
      updateMany: async ({ where, data }: { where: { payoutStatus?: string }; data: Record<string, unknown> }) => {
        if (!db.order || (where.payoutStatus && db.order.payoutStatus !== where.payoutStatus)) return { count: 0 }
        Object.assign(db.order, data)
        return { count: 1 }
      },
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(db.order!, data),
    },
    supplierProfile: { findUnique: async () => ({ trustScore: 90, lightningAdminOverride: false, lightningEnabled: true }) },
    user: { findUnique: async ({ where }: { where: { id: string } }) => ({ stripeAccountId: where.id === "sup" ? "acct_S" : "acct_A" }) },
    transferAttempt: {
      count: async () => db.attempts.filter((a) => a.status === "SUCCESS" || a.stripeTransferId).length,
      findMany: async () => db.attempts,
      upsert: async ({ create }: { create: Attempt }) => {
        if (db.recordFails) throw new Error("db down")
        db.attempts = db.attempts.filter((a) => a.role !== create.role)
        db.attempts.push({ ...create })
      },
    },
    merchantPayoutLedger: { count: async () => db.ledger.length },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  }
  return { prisma }
})

import { isProvenNotCreated, triggerLightningPayout, type LightningPayoutResult } from "@/lib/stripe-lightning"

const reasonOf = (r: LightningPayoutResult) => ("reason" in r ? r.reason : undefined)

function stripeError(type: string, statusCode?: number, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(type), { type, statusCode, ...extra })
}

beforeEach(() => {
  // These tests prove what happens if Lightning is re-enabled: the temporary lock is lifted for them.
  process.env.LIGHTNING_PAYOUTS_MODE = "enabled"
  db.order = {
    id: "o1", supplierId: "sup", affiliateId: "aff", productId: "p", payoutStatus: "PENDING",
    supplierPayoutCents: 1500, affiliatePayoutCents: 200, stripePaymentIntentId: "pi_1", stripeChargeId: "ch_1",
    currency: "EUR", stripeTransferId: null, payoutTransferIds: null, product: { name: "x" },
  }
  db.attempts = [
    { orderId: "o1", role: "SUPPLIER", status: "PENDING", stripeTransferId: null, amountCents: 1500 },
    { orderId: "o1", role: "AFFILIATE", status: "PENDING", stripeTransferId: null, amountCents: 200 },
  ]
  db.ledger = []
  db.recordFails = false
  stripeCalls.create = []
  stripeCalls.plan = []
  alerts.list = []
})

describe("Lightning A3 hotfix", () => {
  it("A3: the supplier leg already paid by process-transfers → Lightning creates NOTHING", async () => {
    db.attempts[0] = { ...db.attempts[0], status: "SUCCESS", stripeTransferId: "tr_pt" }
    expect(await triggerLightningPayout("o1")).toEqual({ success: false, reason: "leg_already_paid:transfer_attempt" })
    expect(stripeCalls.create).toHaveLength(0)
    expect(db.order!.payoutStatus).toBe("PENDING")
  })

  it("any payment trace blocks it: ledger row, order reference, payout transfer ids", async () => {
    db.ledger.push({ orderId: "o1", stripeTransferId: "tr_x" })
    expect((await triggerLightningPayout("o1")).success).toBe(false)
    db.ledger = []
    db.order!.stripeTransferId = "tr_legacy"
    expect(await triggerLightningPayout("o1")).toEqual({ success: false, reason: "leg_already_paid:order_transfer_reference" })
    db.order!.stripeTransferId = null
    db.order!.payoutTransferIds = ["tr_a"]
    expect((await triggerLightningPayout("o1")).success).toBe(false)
    expect(stripeCalls.create).toHaveLength(0)
  })

  it("normal path: both legs, with process-transfers' own idempotency keys, recorded, order PAID", async () => {
    expect(await triggerLightningPayout("o1")).toEqual({ success: true })
    expect(stripeCalls.create.map((c) => c.key)).toEqual(["transfer_o1_SUPPLIER", "transfer_o1_AFFILIATE"])
    expect(db.attempts.every((a) => a.status === "SUCCESS")).toBe(true)
    expect(db.ledger).toHaveLength(2)
    expect(db.order!.payoutStatus).toBe("PAID")
    // A replay pays nothing more.
    db.order!.payoutStatus = "PENDING"
    await triggerLightningPayout("o1")
    expect(stripeCalls.create).toHaveLength(2)
  })

  it("supplier paid, reseller REFUSED by Stripe → supplier recorded at once, order handed back, never re-paid", async () => {
    stripeCalls.plan = ["ok", stripeError("StripeInvalidRequestError", 400, { code: "insufficient_capabilities_for_transfer" })]
    const r = await triggerLightningPayout("o1")
    expect(r.success).toBe(false)
    expect(db.order!.payoutStatus).toBe("PENDING")
    expect(db.attempts.find((a) => a.role === "SUPPLIER")).toMatchObject({ status: "SUCCESS", stripeTransferId: "tr_1" })
    expect(db.ledger).toHaveLength(1)
    // The OLD code reset to PENDING with nothing recorded → process-transfers paid the supplier again. Now a later
    // Lightning run refuses, and process-transfers finds the supplier attempt SUCCESS (not PENDING): it pays only the reseller.
    expect(reasonOf(await triggerLightningPayout("o1"))).toBe("leg_already_paid:transfer_attempt")
    expect(stripeCalls.create).toHaveLength(2)
  })

  it("reseller transfer outcome UNKNOWN (network) → order kept PROCESSING, alert, nothing released", async () => {
    stripeCalls.plan = ["ok", stripeError("StripeConnectionError")]
    expect(await triggerLightningPayout("o1")).toEqual({ success: false, reason: "lightning_outcome_uncertain:affiliate" })
    expect(db.order!.payoutStatus).toBe("PROCESSING")
    expect(alerts.list.join(" ")).toMatch(/IN DOUBT/)
  })

  it("Stripe idempotency conflict (a racing rail used the shared key) is a doubt, not a refusal", async () => {
    stripeCalls.plan = [stripeError("StripeIdempotencyError", 400, { rawType: "idempotency_error" })]
    expect(reasonOf(await triggerLightningPayout("o1"))).toBe("lightning_outcome_uncertain:supplier")
    expect(db.order!.payoutStatus).toBe("PROCESSING")
  })

  it("transfer created but recording fails → PROCESSING kept, alert carries the transfer id", async () => {
    db.recordFails = true
    expect(reasonOf(await triggerLightningPayout("o1"))).toBe("lightning_record_failed:supplier")
    expect(db.order!.payoutStatus).toBe("PROCESSING")
    expect(alerts.list.join(" ")).toMatch(/tr_1/)
    expect(stripeCalls.create).toHaveLength(1)
  })

  it("an order already claimed by another run is not paid", async () => {
    db.order!.payoutStatus = "PROCESSING"
    expect((await triggerLightningPayout("o1")).success).toBe(false)
    expect(stripeCalls.create).toHaveLength(0)
  })

  it("concurrent runs on the same order: only one reaches Stripe, each leg is created once", async () => {
    const results = await Promise.all([triggerLightningPayout("o1"), triggerLightningPayout("o1"), triggerLightningPayout("o1")])
    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(stripeCalls.create.map((c) => c.key)).toEqual(["transfer_o1_SUPPLIER", "transfer_o1_AFFILIATE"])
  })

  it("repeated calls after success, after a doubt and after a recording failure pay nothing more", async () => {
    await triggerLightningPayout("o1")
    for (let i = 0; i < 3; i++) await triggerLightningPayout("o1")
    expect(stripeCalls.create).toHaveLength(2)
  })

  it("after a doubt, a later call and a reset to PENDING by hand still pay nothing (the leg left a trace)", async () => {
    stripeCalls.plan = ["ok", stripeError("StripeAPIError", 500)]
    await triggerLightningPayout("o1")
    expect(db.order!.payoutStatus).toBe("PROCESSING")
    await triggerLightningPayout("o1")
    db.order!.payoutStatus = "PENDING" // someone "unsticks" the order without checking Stripe
    expect(reasonOf(await triggerLightningPayout("o1"))).toBe("leg_already_paid:transfer_attempt")
    expect(stripeCalls.create).toHaveLength(2)
  })

  it("supplier refused (proved) → claim released, a retry pays each leg exactly once", async () => {
    stripeCalls.plan = [stripeError("StripeInvalidRequestError", 400, { code: "account_invalid" })]
    expect((await triggerLightningPayout("o1")).success).toBe(false)
    expect(db.order!.payoutStatus).toBe("PENDING")
    expect(await triggerLightningPayout("o1")).toEqual({ success: true })
    expect(stripeCalls.create.map((c) => c.key)).toEqual(["transfer_o1_SUPPLIER", "transfer_o1_SUPPLIER", "transfer_o1_AFFILIATE"])
    expect(db.ledger).toHaveLength(2)
  })

  it("locked (default, no LIGHTNING_PAYOUTS_MODE): nothing is read, claimed or paid", async () => {
    delete process.env.LIGHTNING_PAYOUTS_MODE
    expect(await triggerLightningPayout("o1")).toEqual({ success: false, reason: "lightning_locked" })
    expect(stripeCalls.create).toHaveLength(0)
    expect(db.order!.payoutStatus).toBe("PENDING")
  })

  it("only proved refusals count as 'not created'", () => {
    expect(isProvenNotCreated(stripeError("StripeInvalidRequestError", 400))).toBe(true)
    expect(isProvenNotCreated(stripeError("StripeRateLimitError", 429))).toBe(true)
    expect(isProvenNotCreated(stripeError("StripeConnectionError"))).toBe(false)
    expect(isProvenNotCreated(stripeError("StripeAPIError", 500))).toBe(false)
    expect(isProvenNotCreated(stripeError("StripeInvalidRequestError", 409))).toBe(false)
    expect(isProvenNotCreated(stripeError("StripeInvalidRequestError"))).toBe(false)
    expect(isProvenNotCreated(new Error("timeout"))).toBe(false)
  })
})
