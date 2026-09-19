/**
 * End-to-end money test against a REAL database (Prisma, real constraints, real upserts).
 * Only Stripe is mocked. Opt-in: RUN_DB_TESTS=1, and only ever against the dedicated test database
 * declared in .env.test.local (DATABASE_URL_TEST) — see lib/testing/db-test-guard.ts.
 *
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/money-e2e-db.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { computeSaleSplit, RESELLER_PLATFORM_FEE_BPS } from "@/lib/money/sale-split"
import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase() // throws unless DATABASE_URL_TEST is a dedicated, non-protected database

const transfersCreate = vi.fn(async (args: { amount: number; destination: string }) => ({
  id: `tr_${Math.random().toString(36).slice(2, 10)}`,
  amount: args.amount,
}))

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/transfers/split-slack-alert", () => ({ alertSplitTransferFailed: vi.fn(async () => {}) }))
vi.mock("@/lib/order-transfer-gating", () => ({ evaluateTransferReleaseForRole: () => ({ eligible: true }) }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    // One charge per payment intent (Order.stripeChargeId is unique in the schema).
    paymentIntents: { retrieve: async (id: string) => ({ latest_charge: `ch_${id}` }) },
    accounts: { retrieve: async () => ({ capabilities: { transfers: "active" } }) },
    transfers: { create: transfersCreate },
  }),
}))

const stamp = Date.now()
const session = (id: string) => ({ id, payment_intent: `pi_${id}` }) as never

type Scenario = { name: string; wholesale: number; commissionBps: number; markup: number; categoryBps: number }

// Remote database: every query is a network round-trip, so allow generous per-test timeouts.
describe.skipIf(!RUN_DB)("money e2e — real DB, mocked Stripe", { timeout: 180_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let schedule: (typeof import("@/lib/transfers/schedule-from-checkout"))["scheduleMarketplaceTransferAttempts"]
  let processJob: (typeof import("@/lib/transfers/process-transfers"))["runProcessTransfersJob"]

  const ids = { supplier: "", affiliate: "", product: "", listing: "", orders: [] as string[] }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ scheduleMarketplaceTransferAttempts: schedule } = await import("@/lib/transfers/schedule-from-checkout"))
    ;({ runProcessTransfersJob: processJob } = await import("@/lib/transfers/process-transfers"))

    const supplier = await prisma.user.create({
      data: { email: `money-e2e-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "E2E Supplier", stripeAccountId: "acct_e2e_supplier" },
    })
    const affiliate = await prisma.user.create({
      data: { email: `money-e2e-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "E2E Reseller", stripeAccountId: "acct_e2e_reseller" },
    })
    const product = await prisma.product.create({
      data: { supplierId: supplier.id, name: "E2E product", description: "money e2e", basePriceCents: 10_000, commissionRate: 10 },
    })
    const listing = await prisma.affiliateProduct.create({
      data: { affiliateId: affiliate.id, productId: product.id, sellingPriceCents: 13_000 },
    })
    Object.assign(ids, { supplier: supplier.id, affiliate: affiliate.id, product: product.id, listing: listing.id })
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    // Also sweeps leftovers of earlier interrupted runs (same email prefix, test database only).
    const users = await prisma.user.findMany({
      where: { email: { startsWith: "money-e2e-", endsWith: "@affisell.test" } },
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

  /** Order row shaped exactly as checkout finalisation stores it (from the canonical split). */
  async function seedOrder(s: Scenario, tag: string, override: Record<string, unknown> = {}) {
    const split = computeSaleSplit({
      wholesaleCents: s.wholesale,
      commissionBps: s.commissionBps,
      markupCents: s.markup,
      supplierFeeBps: s.categoryBps,
      resellerFeeBps: RESELLER_PLATFORM_FEE_BPS,
    })
    const line = s.wholesale + s.markup
    const order = await prisma.order.create({
      data: {
        productId: ids.product,
        affiliateProductId: ids.listing,
        supplierId: ids.supplier,
        affiliateId: ids.affiliate,
        customerEmail: `buyer-${tag}@affisell.test`,
        shippingAddress: { country: "FR" },
        stripeSessionId: `cs_e2e_${stamp}_${tag}`,
        basePriceCents: s.wholesale,
        supplierPriceCents: s.wholesale,
        sellingPriceCents: line,
        subtotalCents: line,
        totalCents: line,
        taxCents: 0,
        commissionCents: split.commissionCents,
        marginCents: s.markup,
        affiliateMarginCents: s.markup,
        affiliateMarginRetainedCents: s.markup,
        affiliatePayoutCents: split.commissionCents,
        supplierCommissionRateBps: s.commissionBps,
        affisellCommissionRateBps: s.categoryBps,
        supplierFeeCents: split.supplierFeeCents,
        affiliateFeeCents: split.resellerFeeCents,
        affisellFeeCents: split.platformFeeCents,
        supplierPayoutCents: split.supplierPayoutCents,
        ...override,
      } as never,
    })
    ids.orders.push(order.id)
    return { order, split }
  }

  const attemptsOf = (orderId: string) =>
    prisma.transferAttempt.findMany({ where: { orderId }, orderBy: { role: "asc" } })

  it("schedules exactly the canonical supplier and reseller amounts (catalog sale)", async () => {
    const s: Scenario = { name: "catalog", wholesale: 10_000, commissionBps: 1000, markup: 3000, categoryBps: 1500 }
    const { order, split } = await seedOrder(s, "healthy")
    const res = await schedule(session(order.stripeSessionId), order.id)
    expect(res.scheduled).toBe(true)

    const attempts = await attemptsOf(order.id)
    const supplier = attempts.find((a) => a.role === "SUPPLIER")!
    const affiliate = attempts.find((a) => a.role === "AFFILIATE")!
    expect(supplier.amountCents).toBe(split.supplierPayoutCents) // 7 500
    expect(affiliate.amountCents).toBe(split.resellerPayoutCents) // 3 200
    expect(supplier.status).toBe("PENDING")
    // Conservation: partners + platform = what the buyer paid (HT), to the cent.
    expect(supplier.amountCents + affiliate.amountCents + split.platformFeeCents).toBe(s.wholesale + s.markup)
  })

  it("is idempotent: scheduling twice never duplicates or changes the payout", async () => {
    const s: Scenario = { name: "idem", wholesale: 4_990, commissionBps: 1200, markup: 1_510, categoryBps: 1200 }
    const { order } = await seedOrder(s, "idem")
    await schedule(session(order.stripeSessionId), order.id)
    const first = await attemptsOf(order.id)
    await schedule(session(order.stripeSessionId), order.id)
    await schedule(session(order.stripeSessionId), order.id)
    const again = await attemptsOf(order.id)
    expect(again).toHaveLength(2)
    expect(again.map((a) => [a.role, a.amountCents])).toEqual(first.map((a) => [a.role, a.amountCents]))
  })

  it("pays each partner once, with the right amount, even if the job runs repeatedly", async () => {
    const s: Scenario = { name: "pay", wholesale: 8_000, commissionBps: 1500, markup: 2_000, categoryBps: 700 }
    const { order, split } = await seedOrder(s, "pay")
    await schedule(session(order.stripeSessionId), order.id)

    transfersCreate.mockClear()
    await processJob({ orderId: order.id })
    await processJob({ orderId: order.id })
    await processJob({ orderId: order.id })

    const calls = transfersCreate.mock.calls.map((c) => c[0] as { amount: number; destination: string })
    expect(calls).toHaveLength(2)
    expect(calls.find((c) => c.destination === "acct_e2e_supplier")?.amount).toBe(split.supplierPayoutCents)
    expect(calls.find((c) => c.destination === "acct_e2e_reseller")?.amount).toBe(split.resellerPayoutCents)
    const done = await attemptsOf(order.id)
    expect(done.every((a) => a.status === "SUCCESS")).toBe(true)
    expect(calls.reduce((n, c) => n + c.amount, 0)).toBeLessThanOrEqual(s.wholesale + s.markup)
  })

  it("blocks a corrupted line whose payouts exceed what was sold (nothing is transferred)", async () => {
    const s: Scenario = { name: "corrupt", wholesale: 10_000, commissionBps: 0, markup: 3_000, categoryBps: 1500 }
    // Stored commission far above the line, no bps to recompute from: the double-count signature.
    const { order } = await seedOrder(s, "corrupt", { commissionCents: 40_000, affiliatePayoutCents: 40_000 })
    transfersCreate.mockClear()
    const res = await schedule(session(order.stripeSessionId), order.id)
    expect(res.scheduled).toBe(false)
    const attempts = await attemptsOf(order.id)
    expect(attempts.every((a) => a.status === "FAILED" && a.errorCode === "PAYOUT_EXCEEDS_LINE")).toBe(true)
    await processJob({ orderId: order.id })
    expect(transfersCreate).not.toHaveBeenCalled()
  })

  it("keeps conservation to the cent on 40 random healthy lines", async () => {
    let seed = 1234567
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 40; i++) {
      const s: Scenario = {
        name: `fuzz-${i}`,
        wholesale: 500 + Math.floor(rnd() * 200_000),
        commissionBps: Math.floor(rnd() * 3000),
        markup: Math.floor(rnd() * 80_000),
        categoryBps: [700, 1200, 1500, 2000][Math.floor(rnd() * 4)]!,
      }
      const { order, split } = await seedOrder(s, `fz${i}`)
      await schedule(session(order.stripeSessionId), order.id)
      const attempts = await attemptsOf(order.id)
      const paid = attempts.reduce((n, a) => n + a.amountCents, 0)
      expect(paid + split.platformFeeCents, JSON.stringify(s)).toBe(s.wholesale + s.markup)
      expect(paid).toBeLessThanOrEqual(s.wholesale + s.markup)
    }
  }, 120_000)
})
