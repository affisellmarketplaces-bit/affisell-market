/**
 * Money STATE tests against a REAL database (finalisation master doc, D1 / D2 / D3 — H1 evidence).
 * Only Stripe, alerts and the refund handler are mocked; the order, transfer-attempt and webhook rows, the row locks
 * and the unique constraints are the real ones. Opt-in: RUN_DB_TESTS=1, and only ever against the dedicated test database
 * declared in .env.test.local (DATABASE_URL_TEST) — see lib/testing/db-test-guard.ts.
 *
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/money-state-db.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { computeSaleSplit, RESELLER_PLATFORM_FEE_BPS } from "@/lib/money/sale-split"
import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase() // throws unless DATABASE_URL_TEST is a dedicated, non-protected database

const transfersCreate = vi.fn(async (args: { amount: number; destination: string }) => ({
  id: `tr_${Math.random().toString(36).slice(2, 10)}`,
  amount: args.amount,
}))
const handleRefunded = vi.fn(async (_charge: unknown) => {})

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/transfers/split-slack-alert", () => ({ alertSplitTransferFailed: vi.fn(async () => {}) }))
// The release gate is mocked "eligible" on purpose: the closed-order guard under test runs BEFORE it.
vi.mock("@/lib/order-transfer-gating", () => ({ evaluateTransferReleaseForRole: () => ({ eligible: true }) }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: async (id: string) => ({ latest_charge: `ch_${id}` }) },
    accounts: { retrieve: async () => ({ capabilities: { transfers: "active" } }) },
    transfers: { create: transfersCreate },
  }),
}))
vi.mock("@/lib/stripe-charge-refunded", () => ({ handleStripeChargeRefunded: (c: unknown) => handleRefunded(c) }))
vi.mock("@/lib/stripe-pro", () => ({
  activateProFromCheckoutSession: vi.fn(),
  deactivateProFromSubscription: vi.fn(),
  syncProFromSubscriptionUpdate: vi.fn(),
}))
vi.mock("@/lib/stripe-invoice-payment-failed", () => ({ handleStripeInvoicePaymentFailed: vi.fn() }))
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }))

const stamp = Date.now()
const session = (id: string) => ({ id, payment_intent: `pi_${id}` }) as never

describe.skipIf(!RUN_DB)("money state — real DB, mocked Stripe", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let schedule: (typeof import("@/lib/transfers/schedule-from-checkout"))["scheduleMarketplaceTransferAttempts"]
  let processJob: (typeof import("@/lib/transfers/process-transfers"))["runProcessTransfersJob"]
  let processEvent: (typeof import("@/lib/stripe-webhook-processor"))["processStripeWebhookEvent"]

  const ids = { supplier: "", affiliate: "", product: "", listing: "" }
  const webhookIds: string[] = []

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ scheduleMarketplaceTransferAttempts: schedule } = await import("@/lib/transfers/schedule-from-checkout"))
    ;({ runProcessTransfersJob: processJob } = await import("@/lib/transfers/process-transfers"))
    ;({ processStripeWebhookEvent: processEvent } = await import("@/lib/stripe-webhook-processor"))

    const supplier = await prisma.user.create({
      data: { email: `money-state-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "State Supplier", stripeAccountId: "acct_state_supplier" },
    })
    const affiliate = await prisma.user.create({
      data: { email: `money-state-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "State Reseller", stripeAccountId: "acct_state_reseller" },
    })
    const product = await prisma.product.create({
      data: { supplierId: supplier.id, name: "State product", description: "money state", basePriceCents: 10_000, commissionRate: 10 },
    })
    const listing = await prisma.affiliateProduct.create({
      data: { affiliateId: affiliate.id, productId: product.id, sellingPriceCents: 13_000 },
    })
    Object.assign(ids, { supplier: supplier.id, affiliate: affiliate.id, product: product.id, listing: listing.id })
  }, 60_000)

  beforeEach(() => {
    transfersCreate.mockClear()
    handleRefunded.mockReset()
    handleRefunded.mockResolvedValue(undefined)
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.processedWebhook.deleteMany({ where: { id: { startsWith: "evt_money_state_" } } })
    const users = await prisma.user.findMany({
      where: { email: { startsWith: "money-state-", endsWith: "@affisell.test" } },
      select: { id: true },
    })
    const userIds = users.map((u) => u.id)
    if (userIds.length > 0) {
      const orderIds = (
        await prisma.order.findMany({
          where: { OR: [{ supplierId: { in: userIds } }, { affiliateId: { in: userIds } }] },
          select: { id: true },
        })
      ).map((o) => o.id)
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.affiliateProduct.deleteMany({ where: { affiliateId: { in: userIds } } })
      await prisma.product.deleteMany({ where: { supplierId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    await prisma.$disconnect()
  }, 60_000)

  async function seedOrder(tag: string, override: Record<string, unknown> = {}) {
    const wholesale = 10_000
    const markup = 3_000
    const split = computeSaleSplit({
      wholesaleCents: wholesale,
      commissionBps: 1000,
      markupCents: markup,
      supplierFeeBps: 1500,
      resellerFeeBps: RESELLER_PLATFORM_FEE_BPS,
    })
    const line = wholesale + markup
    return prisma.order.create({
      data: {
        productId: ids.product,
        affiliateProductId: ids.listing,
        supplierId: ids.supplier,
        affiliateId: ids.affiliate,
        customerEmail: `buyer-${tag}@affisell.test`,
        shippingAddress: { country: "FR" },
        stripeSessionId: `cs_state_${stamp}_${tag}`,
        basePriceCents: wholesale,
        supplierPriceCents: wholesale,
        sellingPriceCents: line,
        subtotalCents: line,
        totalCents: line,
        taxCents: 0,
        commissionCents: split.commissionCents,
        marginCents: markup,
        affiliateMarginCents: markup,
        affiliateMarginRetainedCents: markup,
        affiliatePayoutCents: split.commissionCents,
        supplierCommissionRateBps: 1000,
        affisellCommissionRateBps: 1500,
        supplierFeeCents: split.supplierFeeCents,
        affiliateFeeCents: split.resellerFeeCents,
        affisellFeeCents: split.platformFeeCents,
        supplierPayoutCents: split.supplierPayoutCents,
        ...override,
      } as never,
    })
  }

  const attemptsOf = (orderId: string) => prisma.transferAttempt.findMany({ where: { orderId }, orderBy: { role: "asc" } })
  const reload = (orderId: string) => prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  describe("D1 / D3 — a refunded order stays closed", () => {
    it("a late payment confirmation does not reopen a refunded order, and its pending payouts are cancelled instead of paid", async () => {
      const order = await seedOrder("refund-reopen")
      expect((await schedule(session(order.stripeSessionId), order.id)).scheduled).toBe(true)
      expect((await attemptsOf(order.id)).every((a) => a.status === "PENDING")).toBe(true)

      // The buyer is refunded in full (what charge.refunded does to the order).
      await prisma.order.update({ where: { id: order.id }, data: { status: "refunded", paymentSettlementStatus: "REFUNDED" } })

      // Stripe retries checkout.session.completed / the reconcile cron runs: must not reopen the order.
      const again = await schedule(session(order.stripeSessionId), order.id)
      expect(again).toMatchObject({ scheduled: false, reason: "order_closed" })
      const afterSchedule = await reload(order.id)
      expect(afterSchedule.status).toBe("refunded")
      expect(afterSchedule.paymentSettlementStatus).toBe("REFUNDED")

      // The payout job must not send the pending transfers either.
      await processJob({ orderId: order.id })
      expect(transfersCreate).not.toHaveBeenCalled()
      const attempts = await attemptsOf(order.id)
      expect(attempts.every((a) => a.status === "FAILED" && a.errorCode === "ORDER_CLOSED")).toBe(true)
      expect((await reload(order.id)).paymentSettlementStatus).toBe("REFUNDED")
    })

    it("a stale 'paid' status with a REFUNDED settlement is also closed", async () => {
      const order = await seedOrder("refund-stale-status")
      await schedule(session(order.stripeSessionId), order.id)
      await prisma.order.update({ where: { id: order.id }, data: { paymentSettlementStatus: "REFUNDED" } })
      await processJob({ orderId: order.id })
      expect(transfersCreate).not.toHaveBeenCalled()
      expect((await attemptsOf(order.id)).every((a) => a.status === "FAILED")).toBe(true)
    })

    it("an order that is already shipped is not moved back to paid by a re-schedule", async () => {
      const order = await seedOrder("shipped-keep", { status: "shipped", paymentSettlementStatus: "PAID" })
      const res = await schedule(session(order.stripeSessionId), order.id)
      expect(res.scheduled).toBe(true)
      const after = await reload(order.id)
      expect(after.status).toBe("shipped")
      expect(after.paymentSettlementStatus).toBe("PAID")
    })

    it("a normal paid order is still paid out exactly once (no regression)", async () => {
      const order = await seedOrder("normal-pay")
      await schedule(session(order.stripeSessionId), order.id)
      await processJob({ orderId: order.id })
      await processJob({ orderId: order.id })
      expect(transfersCreate).toHaveBeenCalledTimes(2)
      const done = await reload(order.id)
      expect(done.paymentSettlementStatus).toBe("SETTLED")
    })
  })

  describe("D2 — a failed Stripe event is replayed when Stripe retries it", () => {
    const eventId = (tag: string) => {
      const id = `evt_money_state_${stamp}_${tag}`
      webhookIds.push(id)
      return id
    }
    const refundedEvent = (id: string) =>
      ({ id, type: "charge.refunded", data: { object: { id: `ch_${id}` } } }) as never

    it("first attempt fails (500 to Stripe), the retry is processed instead of being swallowed as a duplicate", async () => {
      const id = eventId("fail-then-retry")
      handleRefunded.mockRejectedValueOnce(new Error("handler exploded"))

      const first = await processEvent(refundedEvent(id))
      expect(first.status).toBe("failed")
      expect((await prisma.processedWebhook.findUniqueOrThrow({ where: { id } })).status).toBe("failed")

      const retry = await processEvent(refundedEvent(id)) // Stripe re-sends the same event id
      expect(retry.duplicate).toBe(false)
      expect(retry.status).toBe("success")
      expect(handleRefunded).toHaveBeenCalledTimes(2)
      const row = await prisma.processedWebhook.findUniqueOrThrow({ where: { id } })
      expect(row.status).toBe("success")

      const third = await processEvent(refundedEvent(id)) // a success is a duplicate for ever
      expect(third.duplicate).toBe(true)
      expect(handleRefunded).toHaveBeenCalledTimes(2)
    })

    it("two simultaneous Stripe retries of a failed event process it exactly once", async () => {
      const id = eventId("concurrent")
      await prisma.processedWebhook.create({ data: { id, orderId: null, status: "failed", error: "earlier failure" } })
      // Hold the handler open so both transactions overlap on the same row.
      handleRefunded.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 400))
      })

      await Promise.all([processEvent(refundedEvent(id)), processEvent(refundedEvent(id))])

      expect(handleRefunded).toHaveBeenCalledTimes(1)
      expect((await prisma.processedWebhook.findUniqueOrThrow({ where: { id } })).status).toBe("success")
    })

    it("a success or skipped record is never replayed", async () => {
      for (const status of ["success", "skipped"]) {
        const id = eventId(`stay-${status}`)
        await prisma.processedWebhook.create({ data: { id, orderId: null, status } })
        const res = await processEvent(refundedEvent(id))
        expect(res.duplicate).toBe(true)
      }
      expect(handleRefunded).not.toHaveBeenCalled()
    })
  })
})
