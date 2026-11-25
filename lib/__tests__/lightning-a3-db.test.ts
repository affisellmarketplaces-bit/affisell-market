/**
 * A3 hotfix + temporary lock on a REAL PostgreSQL through the REAL Prisma engine (2026-11-25).
 *
 * What the in-memory tests can not prove: that the order claim (`updateMany … WHERE payoutStatus = 'PENDING'`), the
 * conditional failure write of process-transfers and the per-leg records hold when several Lightning runs and
 * process-transfers runs really interleave on one database. Only Stripe is faked, with the behaviours the guards rely
 * on: a transfer exists once created even if the response is lost; an idempotency key replays its first result and
 * refuses other parameters. The measure is what a real Stripe account would show: how many transfers exist per leg.
 *
 *   Opt-in: RUN_DB_TESTS=1 + a dedicated DATABASE_URL_TEST (lib/testing/db-test-guard.ts). CI: job `lightning-db-tests`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

vi.mock("server-only", () => ({}))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
const ops = vi.hoisted(() => ({ alerts: [] as string[] }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async (t: string) => { ops.alerts.push(t) }) }))
vi.mock("@/lib/transfers/split-slack-alert", () => ({ alertSplitTransferFailed: vi.fn(async () => {}) }))
vi.mock("@/lib/legion/pay-referral-override", () => ({ payLegionOverrideForOrder: async () => ({ paid: false }) }))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({ assertTransfersActive: async () => {} }))
const gate = vi.hoisted(() => ({ eligible: new Set<string>(["SUPPLIER", "AFFILIATE"]) }))
vi.mock("@/lib/order-transfer-gating", () => ({
  evaluateTransferReleaseForRole: (role: string) =>
    gate.eligible.has(role) ? { eligible: true } : { eligible: false, phase: "test", reason: "held_by_test" },
}))

type Mode = "ok" | "lost_response"
const fake = vi.hoisted(() => ({
  transfers: [] as Array<{ id: string; orderId: string; role: string; amount: number }>,
  keys: new Map<string, { body: string; id: string }>(),
  modes: [] as Mode[],
  seq: 0,
}))
function stripeError(type: string, statusCode: number | undefined, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(type), { type, statusCode, ...extra })
}
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: async (id: string) => ({ id, status: "succeeded", latest_charge: `ch_${id}` }) },
    accounts: { retrieve: async () => ({ capabilities: { transfers: "active" } }) },
    transfers: {
      create: async (params: Record<string, unknown>, opts: { idempotencyKey: string }) => {
        await new Promise((r) => setTimeout(r, 15)) // let concurrent runs interleave
        const body = JSON.stringify(params)
        const seen = fake.keys.get(opts.idempotencyKey)
        if (seen) {
          if (seen.body !== body) throw stripeError("StripeIdempotencyError", 400, { rawType: "idempotency_error" })
          return { id: seen.id }
        }
        fake.seq += 1
        const id = `tr_a3db_${fake.seq}`
        const meta = (params.metadata ?? {}) as Record<string, string>
        fake.transfers.push({ id, orderId: String(meta.orderId), role: String(meta.role).toUpperCase(), amount: Number(params.amount) })
        fake.keys.set(opts.idempotencyKey, { body, id })
        if ((fake.modes.shift() ?? "ok") === "lost_response") throw stripeError("StripeConnectionError", undefined)
        return { id }
      },
    },
  }),
}))

const stamp = `a3db${Date.now().toString(36)}`
const transfersOf = (orderId: string, role: string) => fake.transfers.filter((t) => t.orderId === orderId && t.role === role)

describe.skipIf(!RUN_DB)("Lightning A3 + lock — real PostgreSQL", { timeout: 180_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let trigger: (typeof import("@/lib/stripe-lightning"))["triggerLightningPayout"]
  let processJob: (typeof import("@/lib/transfers/process-transfers"))["runProcessTransfersJob"]
  const ids = { supplier: "", affiliate: "", product: "", listing: "" }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ triggerLightningPayout: trigger } = await import("@/lib/stripe-lightning"))
    ;({ runProcessTransfersJob: processJob } = await import("@/lib/transfers/process-transfers"))
    const supplier = await prisma.user.create({
      data: { email: `${stamp}-sup@affisell.test`, role: "SUPPLIER", name: "A3 supplier", stripeAccountId: "acct_a3db_sup" },
    })
    const affiliate = await prisma.user.create({
      data: { email: `${stamp}-aff@affisell.test`, role: "AFFILIATE", name: "A3 reseller", stripeAccountId: "acct_a3db_aff" },
    })
    await prisma.supplierProfile.create({ data: { userId: supplier.id, trustScore: 90, lightningEnabled: true } })
    const product = await prisma.product.create({
      data: { supplierId: supplier.id, name: "A3 product", description: "a3 db", basePriceCents: 10_000, commissionRate: 10 },
    })
    const listing = await prisma.affiliateProduct.create({
      data: { affiliateId: affiliate.id, productId: product.id, sellingPriceCents: 13_000 },
    })
    Object.assign(ids, { supplier: supplier.id, affiliate: affiliate.id, product: product.id, listing: listing.id })
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    const users = [ids.supplier, ids.affiliate].filter(Boolean)
    const orders = (await prisma.order.findMany({ where: { supplierId: { in: users } }, select: { id: true } })).map((o) => o.id)
    await prisma.merchantPayoutLedger.deleteMany({ where: { orderId: { in: orders } } })
    await prisma.transferAttempt.deleteMany({ where: { orderId: { in: orders } } })
    await prisma.order.deleteMany({ where: { id: { in: orders } } })
    await prisma.notification.deleteMany({ where: { userId: { in: users } } })
    await prisma.affiliateProduct.deleteMany({ where: { affiliateId: { in: users } } })
    await prisma.product.deleteMany({ where: { supplierId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.$disconnect()
  }, 60_000)

  beforeEach(() => {
    process.env.LIGHTNING_PAYOUTS_MODE = "enabled" // what happens if Lightning is re-enabled
    gate.eligible = new Set(["SUPPLIER", "AFFILIATE"])
    fake.modes = []
    ops.alerts = []
  })

  /** A paid, shipped order with its two PENDING transfer attempts, as checkout + scheduling leave it. */
  async function seedOrder(tag: string) {
    const order = await prisma.order.create({
      data: {
        productId: ids.product,
        affiliateProductId: ids.listing,
        supplierId: ids.supplier,
        affiliateId: ids.affiliate,
        customerEmail: `buyer-${stamp}-${tag}@affisell.test`,
        shippingAddress: { country: "FR" },
        stripeSessionId: `cs_${stamp}_${tag}`,
        stripePaymentIntentId: `pi_${stamp}_${tag}`,
        stripeChargeId: `ch_pi_${stamp}_${tag}`,
        status: "shipped",
        payoutStatus: "PENDING",
        basePriceCents: 10_000,
        supplierPriceCents: 10_000,
        sellingPriceCents: 13_000,
        subtotalCents: 13_000,
        totalCents: 13_000,
        taxCents: 0,
        commissionCents: 1000,
        marginCents: 3000,
        affiliateMarginCents: 3000,
        affiliatePayoutCents: 1000,
        supplierPayoutCents: 7500,
      } as never,
    })
    await prisma.transferAttempt.createMany({
      data: [
        { orderId: order.id, role: "SUPPLIER", destination: "acct_a3db_sup", amountCents: 7500, status: "PENDING" },
        { orderId: order.id, role: "AFFILIATE", destination: "acct_a3db_aff", amountCents: 1000, status: "PENDING" },
      ] as never,
    })
    return order.id
  }

  it("5 Lightning runs + 2 process-transfers runs at once: no leg ever exists twice at Stripe", async () => {
    const orderId = await seedOrder("race")
    await Promise.all([
      ...Array.from({ length: 5 }, () => trigger(orderId)),
      processJob({ orderId }),
      processJob({ orderId }),
    ])
    // Whatever interleaving happened, later runs of both rails add nothing.
    await Promise.all([trigger(orderId), processJob({ orderId }), trigger(orderId)])
    const sup = transfersOf(orderId, "SUPPLIER")
    const aff = transfersOf(orderId, "AFFILIATE")
    expect(sup.length).toBeLessThanOrEqual(1)
    expect(aff.length).toBeLessThanOrEqual(1)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    // Safety over liveness: when the two rails collide on the shared idempotency key, Lightning cannot tell whether its
    // transfer exists, keeps the order PROCESSING and alerts — the unpaid leg waits for a person, it is never paid twice.
    if (sup.length === 0 || aff.length === 0) {
      expect(order.payoutStatus).toBe("PROCESSING")
      expect(ops.alerts.join(" ")).toMatch(/IN DOUBT/)
    }
    // A leg Stripe paid is never left as an unpaid PENDING attempt without its transfer id.
    const attempts = await prisma.transferAttempt.findMany({ where: { orderId } })
    for (const a of attempts) {
      const paid = transfersOf(orderId, a.role)
      if (paid.length > 0 && a.status === "PENDING") expect(a.stripeTransferId).toBe(paid[0].id)
    }
    console.log("[a3-db race]", { supplier: sup.length, affiliate: aff.length, payoutStatus: order.payoutStatus })
  })

  it("each rail alone on a fresh order pays both legs exactly once (no collision = no manual step)", async () => {
    const a = await seedOrder("solo-lightning")
    await trigger(a)
    expect([transfersOf(a, "SUPPLIER").length, transfersOf(a, "AFFILIATE").length]).toEqual([1, 1])
    const b = await seedOrder("solo-standard")
    await processJob({ orderId: b })
    expect([transfersOf(b, "SUPPLIER").length, transfersOf(b, "AFFILIATE").length]).toEqual([1, 1])
  })

  it("A3: supplier paid by process-transfers, reseller held → Lightning, repeated, pays no second supplier leg", async () => {
    const orderId = await seedOrder("a3")
    gate.eligible = new Set(["SUPPLIER"])
    await processJob({ orderId })
    expect(transfersOf(orderId, "SUPPLIER")).toHaveLength(1)
    for (let i = 0; i < 3; i++) await trigger(orderId)
    expect(transfersOf(orderId, "SUPPLIER")).toHaveLength(1)
    expect(transfersOf(orderId, "AFFILIATE")).toHaveLength(0)
    gate.eligible = new Set(["SUPPLIER", "AFFILIATE"])
    await processJob({ orderId })
    expect(transfersOf(orderId, "SUPPLIER")).toHaveLength(1)
    expect(transfersOf(orderId, "AFFILIATE")).toHaveLength(1)
  })

  it("reseller transfer created but the response is lost → order kept PROCESSING; no rail pays anything more", async () => {
    const orderId = await seedOrder("lost")
    fake.modes = ["ok", "lost_response"]
    const r = await trigger(orderId)
    expect(r).toMatchObject({ success: false })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).payoutStatus).toBe("PROCESSING")
    expect(ops.alerts.join(" ")).toMatch(/IN DOUBT/)
    await Promise.all([processJob({ orderId }), trigger(orderId), processJob({ orderId })])
    expect(transfersOf(orderId, "SUPPLIER")).toHaveLength(1)
    expect(transfersOf(orderId, "AFFILIATE")).toHaveLength(1)
  })

  it("locked (no variable): the database says lightningEnabled = true, yet nothing is claimed or paid", async () => {
    const orderId = await seedOrder("locked")
    delete process.env.LIGHTNING_PAYOUTS_MODE
    expect(await trigger(orderId)).toEqual({ success: false, reason: "lightning_locked" })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).payoutStatus).toBe("PENDING")
    expect(fake.transfers.filter((t) => t.orderId === orderId)).toHaveLength(0)
    // The standard rail still pays the order normally.
    await processJob({ orderId })
    expect(transfersOf(orderId, "SUPPLIER")).toHaveLength(1)
    expect(transfersOf(orderId, "AFFILIATE")).toHaveLength(1)
  })
})
