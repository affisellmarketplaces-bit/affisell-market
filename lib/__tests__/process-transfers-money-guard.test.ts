import { beforeEach, describe, expect, it, vi } from "vitest"

const transfersCreate = vi.fn(async (params: { amount: number }) => ({ id: "tr_new", amount: params.amount }))
const transfersList = vi.fn(async () => ({ data: state.existing }))
const clawbackPartial = vi.fn(async () => ({ executed: true }))
const clawbackFull = vi.fn(async () => ({ executed: true }))
const ledger: Array<Record<string, unknown>> = []
type Refund = { stripeRefundId: string; amountCents: number }
const state: {
  attempt: Record<string, unknown>
  others: Array<{ amountCents: number }>
  /** What the LATE read (just before the Stripe call) sees; `null` = same as the attempt's order. */
  freshOrder: Record<string, unknown> | null
  refunds: Refund[]
  /** Refunds recorded while the transfer was in flight (seen only by the read AFTER the call). */
  refundsAfter: Refund[] | null
  /** Order as seen by the read AFTER the call (e.g. closed by a refund webhook meanwhile). */
  orderAfter: Record<string, unknown> | null
  existing: Array<Record<string, unknown>>
  freshReads: number
  openDisputeHolds: number
  /** Stripe's own view of the charge's refunds; `null` = mirrors our rows (consistent, all succeeded). */
  stripeRefunds: Array<{ id: string; amount: number; status: string; metadata?: Record<string, string> }> | null
  charge: Record<string, unknown>
  stripeDown: boolean
  claimCount: number
  /** Scripted results of successive updateMany calls (claim, renewal, …); then `claimCount`. */
  updateManyResults: number[]
  stripeDisputes: Array<{ id: string; status: string }>
} = {
  attempt: {},
  others: [],
  freshOrder: null,
  refunds: [],
  refundsAfter: null,
  orderAfter: null,
  existing: [],
  freshReads: 0,
  openDisputeHolds: 0,
  stripeRefunds: null,
  charge: {},
  stripeDown: false,
  claimCount: 1,
  updateManyResults: [],
  stripeDisputes: [],
}
const updates: Array<Record<string, unknown>> = []
const updateManyCalls: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = []

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
  recordStripePayoutSettlement: vi.fn(async (_tx: unknown, args: Record<string, unknown>) => {
    ledger.push(args)
    return true
  }),
  supersedePendingTransferAttempt: vi.fn(async () => {}),
}))
const chargesRetrieve = vi.fn(async (id: string) => {
  if (state.stripeDown) throw new Error("stripe unavailable")
  return { id, status: "succeeded", captured: true, disputed: false, currency: "eur", ...state.charge }
})
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    accounts: { retrieve: async () => ({ capabilities: { transfers: "active" } }) },
    transfers: { create: transfersCreate, list: transfersList },
    charges: { retrieve: chargesRetrieve },
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_1" }) },
    disputes: {
      list: () => ({
        async *[Symbol.asyncIterator]() {
          for (const d of state.stripeDisputes) yield d
        },
      }),
    },
    refunds: {
      // Async-iterable like the SDK's auto-paging list.
      list: () => ({
        async *[Symbol.asyncIterator]() {
          const rows =
            state.stripeRefunds ??
            state.refunds.map((r) => ({ id: r.stripeRefundId, amount: r.amountCents, status: "succeeded" }))
          for (const r of rows) yield r
        },
      }),
    },
  }),
}))
vi.mock("@/lib/order-payout", () => ({
  clawbackOrderPayoutsOnPartialRefund: clawbackPartial,
  clawbackOrderPayoutsOnRefund: clawbackFull,
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
      // The lease claim (one run at a time), its renewal before create, and the conditional failure write.
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateManyCalls.push(args)
        const scripted = state.updateManyResults.shift()
        return { count: scripted ?? state.claimCount }
      },
    },
    order: {
      findUnique: async (args: { select?: { stripeRefunds?: unknown } }) => {
        if (!args.select?.stripeRefunds) return { transferAttempts: [], product: { name: "x" } }
        // Late reads: the first one is « just before the call », the next one « just after ».
        state.freshReads += 1
        const base = state.freshOrder ?? (state.attempt.order as Record<string, unknown>)
        const order = state.freshReads > 1 && state.orderAfter ? state.orderAfter : base
        const refunds = state.freshReads > 1 && state.refundsAfter ? state.refundsAfter : state.refunds
        return { ...order, stripeRefunds: refunds }
      },
      update: async () => ({}),
      findMany: async () => [],
    },
    // Dispute ledger (ProcessedWebhook rows `dispute:…`): `count` is what `hasOpenDisputeHold` reads.
    processedWebhook: { count: async () => state.openDisputeHolds },
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
    transfersList.mockClear()
    clawbackPartial.mockClear()
    clawbackFull.mockClear()
    updates.length = 0
    ledger.length = 0
    state.others = []
    state.freshOrder = null
    state.refunds = []
    state.refundsAfter = null
    state.orderAfter = null
    state.existing = []
    state.freshReads = 0
    state.openDisputeHolds = 0
    state.stripeRefunds = null
    state.charge = {}
    state.stripeDown = false
    state.claimCount = 1
    state.updateManyResults = []
    state.stripeDisputes = []
    updateManyCalls.length = 0
    chargesRetrieve.mockClear()
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

  // Finalisation master doc, D1/D3: a refunded or cancelled order must never release a transfer.
  it.each([
    ["status refunded", { status: "refunded" }],
    ["status cancelled", { status: "CANCELLED" }],
    ["settlement REFUNDED with a stale paid status", { status: "paid", paymentSettlementStatus: "REFUNDED" }],
    ["settlement REFUND_PENDING_CLAWBACK", { status: "paid", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" }],
  ])("never calls Stripe for a closed order (%s) and supersedes the pending attempt", async (_label, orderOver) => {
    const { supersedePendingTransferAttempt } = await import("@/lib/payout-settlement")
    const supersede = supersedePendingTransferAttempt as unknown as ReturnType<typeof vi.fn>
    supersede.mockClear()
    await runOnce(attempt({}, orderOver))
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(supersede).toHaveBeenCalledWith(expect.anything(), "ord_1", "AFFILIATE", "ORDER_CLOSED")
  })

  it("keeps paying a normal paid order after the closed-order guard was added", async () => {
    await runOnce(attempt({}, { status: "paid", paymentSettlementStatus: "PAID" }))
    expect(transfersCreate).toHaveBeenCalledTimes(1)
  })

  it("only monitors when explicitly opted out", async () => {
    process.env.MONEY_GUARD_MODE = "monitor"
    state.others = [{ amountCents: 9500 }]
    await runOnce(attempt({ amountCents: 4500 }))
    expect(transfersCreate).toHaveBeenCalledTimes(1)
  })

  // ── Scenarios added by the financial audit (2026-11-26) ──────────────────────────────────────────────────────────
  // Charged total of the fixture order: 13 000 (subtotal, no tax). A 6 500 refund = half of the sale.

  it("partial refund BEFORE release: pays only what is still owed, same rule and rounding as the paid-role clawback", async () => {
    state.refunds = [{ stripeRefundId: "re_1", amountCents: 6_500 }]
    await runOnce(attempt({}, { paymentSettlementStatus: "PARTIALLY_REFUNDED" }))
    expect(transfersCreate).toHaveBeenCalledTimes(1)
    const [params] = transfersCreate.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(params).toMatchObject({ amount: 1_600, metadata: { scheduledCents: "3200", refundShareCents: "1600" } })
    expect(ledger[0]).toMatchObject({ amountCents: 1_600, stripeTransferId: "tr_new" })
  })

  it("several partial refunds: each refund's share is rounded on its own, like the clawback", async () => {
    // 3 200 × 1 001/13 000 = 246.4 → 246, three times = 738 (one rounding on the sum would give 739).
    state.refunds = [1, 2, 3].map((i) => ({ stripeRefundId: `re_${i}`, amountCents: 1_001 }))
    await runOnce(attempt({}, { paymentSettlementStatus: "PARTIALLY_REFUNDED" }))
    expect((transfersCreate.mock.calls[0] as unknown as [{ amount: number }])[0].amount).toBe(3_200 - 738)
  })

  it("the whole share refunded: no transfer, the attempt is closed", async () => {
    const { supersedePendingTransferAttempt } = await import("@/lib/payout-settlement")
    const supersede = supersedePendingTransferAttempt as unknown as ReturnType<typeof vi.fn>
    supersede.mockClear()
    state.refunds = [{ stripeRefundId: "re_1", amountCents: 13_000 }]
    await runOnce(attempt({}, { paymentSettlementStatus: "PARTIALLY_REFUNDED" }))
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(supersede).toHaveBeenCalledWith(expect.anything(), "ord_1", "AFFILIATE", "REFUNDED_SHARE")
  })

  it("refunded AFTER the attempt was loaded, BEFORE the Stripe call: the late read stops it", async () => {
    const { supersedePendingTransferAttempt } = await import("@/lib/payout-settlement")
    const supersede = supersedePendingTransferAttempt as unknown as ReturnType<typeof vi.fn>
    supersede.mockClear()
    state.freshOrder = { ...(attempt().order as Record<string, unknown>), status: "refunded", paymentSettlementStatus: "REFUNDED" }
    await runOnce(attempt())
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(supersede).toHaveBeenCalledWith(expect.anything(), "ord_1", "AFFILIATE", "ORDER_CLOSED")
  })

  it("Lightning started paying in the meantime: no Connect transfer", async () => {
    state.freshOrder = { ...(attempt().order as Record<string, unknown>), payoutStatus: "PROCESSING" }
    await runOnce(attempt())
    expect(transfersCreate).not.toHaveBeenCalled()
  })

  it("a transfer already created by a lost call (crash, > 24 h): adopted, never paid twice", async () => {
    state.existing = [
      { id: "tr_other", amount: 9_000, destination: "acct_sup", metadata: { role: "SUPPLIER" } },
      { id: "tr_lost", amount: 3_200, destination: "acct_aff", metadata: { role: "AFFILIATE" } },
    ]
    await runOnce(attempt())
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(updates.some((u) => u.status === "SUCCESS" && u.stripeTransferId === "tr_lost")).toBe(true)
    expect(ledger[0]).toMatchObject({ amountCents: 3_200, stripeTransferId: "tr_lost" })
  })

  it("Stripe search unavailable: nothing is created (held, retried next run)", async () => {
    transfersList.mockImplementationOnce(async () => {
      throw new Error("stripe down")
    })
    await runOnce(attempt())
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(updates.some((u) => u.status === "SUCCESS")).toBe(false)
  })

  it("a refund landing WHILE the transfer is in flight is clawed back right after it is recorded", async () => {
    state.refunds = []
    state.refundsAfter = [{ stripeRefundId: "re_late", amountCents: 6_500 }]
    await runOnce(attempt())
    expect(transfersCreate).toHaveBeenCalledTimes(1)
    expect(clawbackPartial).toHaveBeenCalledWith("ord_1", {
      stripeRefundId: "re_late",
      refundAmountCents: 6_500,
      orderTotalCents: 13_000,
    })
  })

  it("a FULL refund landing while in flight triggers the full clawback", async () => {
    state.refundsAfter = [{ stripeRefundId: "re_full", amountCents: 13_000 }]
    state.orderAfter = { ...(attempt().order as Record<string, unknown>), status: "refunded", paymentSettlementStatus: "REFUNDED" }
    await runOnce(attempt())
    expect(transfersCreate).toHaveBeenCalledTimes(1)
    expect(clawbackFull).toHaveBeenCalledWith("ord_1")
    expect(clawbackPartial).not.toHaveBeenCalled()
  })

  it("no refund in flight: no clawback", async () => {
    await runOnce(attempt())
    expect(clawbackPartial).not.toHaveBeenCalled()
    expect(clawbackFull).not.toHaveBeenCalled()
  })
  // Finalisation master doc, D7: while a dispute (chargeback) is open nothing is released, and nothing is cancelled either.
  describe("open dispute", () => {
    it("holds the transfer when the dispute ledger has an open row, even if another writer set the status back to shipped", async () => {
      const { supersedePendingTransferAttempt } = await import("@/lib/payout-settlement")
      const supersede = supersedePendingTransferAttempt as unknown as ReturnType<typeof vi.fn>
      supersede.mockClear()
      state.openDisputeHolds = 1
      const outcome = await runOnce(attempt({}, { status: "shipped", paymentSettlementStatus: "PAID" }))
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(outcome.held).toBe(1)
      expect(outcome.success).toBe(0)
      // The attempt stays PENDING for a later release (won) — it is neither failed nor superseded.
      expect(updates).toEqual([])
      expect(supersede).not.toHaveBeenCalled()
    })

    it("holds the transfer when the order status is disputed, even with no ledger row", async () => {
      state.openDisputeHolds = 0
      const outcome = await runOnce(attempt({}, { status: "disputed", paymentSettlementStatus: "PAID" }))
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(outcome.held).toBe(1)
      expect(updates).toEqual([])
    })

    it("pays again once the dispute is no longer open (ledger closed, status restored)", async () => {
      state.openDisputeHolds = 0
      await runOnce(attempt({}, { status: "shipped", paymentSettlementStatus: "PAID" }))
      expect(transfersCreate).toHaveBeenCalledTimes(1)
    })
  })

  // ── D7 + reconciliation with Stripe at release (2026-11-26) ────────────────────────────────────────────────────────
  describe("Stripe is asked before the money leaves", () => {
    const heldWith = (code: string) => {
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(updates.some((u) => u.errorCode === code && u.status === undefined)).toBe(true)
      expect(updates.some((u) => u.status === "FAILED" || u.status === "SUCCESS")).toBe(false)
    }

    it("a refund at Stripe whose webhook never reached us: HELD, never paid in full", async () => {
      state.stripeRefunds = [{ id: "re_lost", amount: 6_500, status: "succeeded" }]
      await runOnce(attempt())
      heldWith("STRIPE_CHECK_REFUND_NOT_RECORDED")
    })

    it("a PENDING refund at Stripe counts as money going back (held until recorded)", async () => {
      state.stripeRefunds = [{ id: "re_p", amount: 1_000, status: "pending" }]
      await runOnce(attempt())
      heldWith("STRIPE_CHECK_REFUND_NOT_RECORDED")
    })

    it("failed and canceled refunds are not refunds: the full share is paid", async () => {
      state.stripeRefunds = [
        { id: "re_f", amount: 6_500, status: "failed" },
        { id: "re_c", amount: 6_500, status: "canceled" },
      ]
      await runOnce(attempt())
      expect((transfersCreate.mock.calls[0] as unknown as [{ amount: number }])[0].amount).toBe(3_200)
    })

    it("Stripe and our rows agree on two partial refunds: paid exactly payableAfterRefunds", async () => {
      state.refunds = [
        { stripeRefundId: "re_1", amountCents: 1_001 },
        { stripeRefundId: "re_2", amountCents: 1_001 },
      ]
      await runOnce(attempt({}, { paymentSettlementStatus: "PARTIALLY_REFUNDED" }))
      expect((transfersCreate.mock.calls[0] as unknown as [{ amount: number }])[0].amount).toBe(3_200 - 2 * 246)
    })

    it("amounts disagree: HELD", async () => {
      state.refunds = [{ stripeRefundId: "re_1", amountCents: 1_000 }]
      state.stripeRefunds = [{ id: "re_1", amount: 1_500, status: "succeeded" }]
      await runOnce(attempt({}, { paymentSettlementStatus: "PARTIALLY_REFUNDED" }))
      heldWith("STRIPE_CHECK_REFUND_AMOUNT_MISMATCH")
    })

    it("a refund we recorded that FAILED at Stripe: HELD (our rows are wrong)", async () => {
      state.refunds = [{ stripeRefundId: "re_1", amountCents: 1_000 }]
      state.stripeRefunds = [{ id: "re_1", amount: 1_000, status: "failed" }]
      await runOnce(attempt({}, { paymentSettlementStatus: "PARTIALLY_REFUNDED" }))
      heldWith("STRIPE_CHECK_RECORDED_REFUND_NOT_AT_STRIPE")
    })

    it("the charge is DISPUTED at Stripe though no dispute webhook reached us: HELD", async () => {
      state.charge = { disputed: true }
      await runOnce(attempt())
      heldWith("STRIPE_CHECK_CHARGE_DISPUTED")
    })

    it("Stripe unavailable: HELD, attempts not consumed", async () => {
      state.stripeDown = true
      await runOnce(attempt())
      heldWith("STRIPE_CHECK_STRIPE_UNAVAILABLE")
    })

    it("a dispute opened after the attempt was loaded is seen by the late read", async () => {
      state.freshOrder = { ...(attempt().order as Record<string, unknown>), status: "disputed" }
      await runOnce(attempt())
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(chargesRetrieve).not.toHaveBeenCalled()
    })

    it("another run holds the attempt (lease): this one does nothing at all", async () => {
      state.claimCount = 0
      await runOnce(attempt())
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(chargesRetrieve).not.toHaveBeenCalled()
      expect(updates).toEqual([])
    })
  })

  describe("lease outlived (a run slower than 5 min)", () => {
    it("another worker took the attempt over meanwhile: this run creates NOTHING", async () => {
      state.updateManyResults = [1, 0] // claim won, renewal before create refused
      await runOnce(attempt())
      expect(transfersCreate).not.toHaveBeenCalled()
      // The renewal is conditioned on THIS run's lease timestamp.
      expect(updateManyCalls[1]!.where).toMatchObject({ id: "att_1", status: "PENDING" })
      expect(updateManyCalls[1]!.where.lastAttemptAt).toBeInstanceOf(Date)
    })

    it("a Stripe failure never overwrites a SUCCESS recorded by another run (conditional write)", async () => {
      transfersCreate.mockImplementationOnce(async () => {
        throw new Error("idempotency key in use")
      })
      await runOnce(attempt())
      const failureWrite = updateManyCalls.find((c) => c.data.status === "PENDING" || c.data.status === "FAILED")
      expect(failureWrite?.where).toMatchObject({ id: "att_1", status: "PENDING" })
      expect(updates.some((u) => u.status === "PENDING" || u.status === "FAILED")).toBe(false)
    })
  })

  describe("disputes decided by their LIVE status at Stripe", () => {
    it("a dispute WON (charge still flagged disputed): the money goes", async () => {
      state.charge = { disputed: true }
      state.stripeDisputes = [{ id: "dp_1", status: "won" }]
      await runOnce(attempt())
      expect(transfersCreate).toHaveBeenCalledTimes(1)
    })

    it("a dispute still OPEN at Stripe: held", async () => {
      state.charge = { disputed: true }
      state.stripeDisputes = [{ id: "dp_1", status: "won" }, { id: "dp_2", status: "needs_response" }]
      await runOnce(attempt())
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(updates.some((u) => u.errorCode === "STRIPE_CHECK_CHARGE_DISPUTED")).toBe(true)
    })

    it("a dispute LOST at Stripe that our D7 never applied: held", async () => {
      state.charge = { disputed: true }
      state.stripeDisputes = [{ id: "dp_1", status: "lost" }]
      await runOnce(attempt())
      expect(transfersCreate).not.toHaveBeenCalled()
      expect(updates.some((u) => u.errorCode === "STRIPE_CHECK_DISPUTE_LOST_NOT_APPLIED")).toBe(true)
    })
  })
})
