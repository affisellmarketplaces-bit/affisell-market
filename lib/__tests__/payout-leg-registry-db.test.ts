/**
 * Payout leg registry on a REAL PostgreSQL through the REAL Prisma engine (2026-11-25).
 *
 * The table is rebuilt from the MIGRATION file (CHECK constraints + guard trigger), not from the datamodel. Stripe is an
 * in-memory fake that behaves like the real API on the points that matter: a transfer exists once created even if the
 * response is lost; an idempotency key replays its first result and refuses other parameters; keys are forgotten after
 * 24 h (`expireKeys`); the list endpoint returns every transfer of a group.
 *
 * Numbered scenarios = the mission's list (docs/PAYOUT-LEG-REGISTRY.md §7). Rails are exercised for real where they are
 * cheap to set up (process-transfers + Lightning on real orders); the others at the service level.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type { LegTransferRequest, StripeTransferView } from "@/lib/payouts/leg-model"
import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
const ops = vi.hoisted(() => ({ alerts: [] as string[] }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: vi.fn(async (t: string) => { ops.alerts.push(t) }) }))
vi.mock("@/lib/transfers/split-slack-alert", () => ({ alertSplitTransferFailed: vi.fn(async () => {}) }))

const gate = vi.hoisted(() => ({ eligibleRoles: new Set<string>(["SUPPLIER", "AFFILIATE"]) }))
vi.mock("@/lib/order-transfer-gating", () => ({
  evaluateTransferReleaseForRole: (role: string) =>
    gate.eligibleRoles.has(role) ? { eligible: true } : { eligible: false, phase: "test", reason: "held_by_test" },
}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = `lg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const HOUR = 3600_000
const DAY = 24 * HOUR

const transferSeq = { n: 0 }

type Mode = "ok" | "lost_response" | "connection_error" | "refuse" | "rate_limit" | "hang"

function stripeError(type: string, statusCode: number | undefined, message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { type, statusCode, ...extra })
}

/** In-memory Stripe: the behaviours the registry relies on, nothing more. */
class FakeStripe {
  transfers: StripeTransferView[] = []
  keys = new Map<string, { body: string; id: string }>()
  createCalls = 0
  modes: Mode[] = []
  delayMs = 0
  listFails = false
  private hang: { resolve: () => void } | null = null

  /** Unique across every fake of the run, like real Stripe ids (PayoutLeg.stripeTransferId is UNIQUE). */
  newId() {
    transferSeq.n += 1
    return `tr_${stamp}${transferSeq.n}`
  }

  async createTransfer(req: LegTransferRequest, key: string): Promise<{ id: string }> {
    this.createCalls += 1
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs))
    const body = JSON.stringify(req)
    const prior = this.keys.get(key)
    if (prior) {
      if (prior.body !== body) {
        throw stripeError("StripeIdempotencyError", 400, "Keys for idempotent requests can only be used with the same parameters", {
          rawType: "idempotency_error",
        })
      }
      return { id: prior.id }
    }
    const mode = this.modes.shift() ?? "ok"
    if (mode === "refuse") throw stripeError("StripeInvalidRequestError", 400, "Insufficient funds", { code: "balance_insufficient" })
    if (mode === "rate_limit") throw stripeError("StripeRateLimitError", 429, "Too many requests")
    if (mode === "connection_error") throw stripeError("StripeConnectionError", undefined, "ECONNRESET before reaching Stripe")
    const t: StripeTransferView = {
      id: this.newId(),
      amount: req.amount,
      currency: req.currency,
      destination: req.destination,
      transfer_group: req.transfer_group,
      metadata: { ...req.metadata },
      created: Math.floor(Date.now() / 1000),
    }
    this.transfers.push(t)
    this.keys.set(key, { body, id: t.id })
    if (mode === "lost_response") throw stripeError("StripeConnectionError", undefined, "Request timed out")
    if (mode === "hang") {
      await new Promise<void>((resolve) => {
        this.hang = { resolve }
      })
    }
    return { id: t.id }
  }

  releaseHang() {
    this.hang?.resolve()
  }

  async listTransfersByGroup(group: string) {
    if (this.listFails) throw stripeError("StripeConnectionError", undefined, "list failed")
    return { data: this.transfers.filter((t) => t.transfer_group === group), has_more: false }
  }

  /** Stripe prunes idempotency keys after ~24 h. */
  expireKeys() {
    this.keys.clear()
  }

  inGroup(group: string) {
    return this.transfers.filter((t) => t.transfer_group === group)
  }
}

/** The fake as the `stripe` SDK client the rails use through getStripeClient(). */
const sdk = vi.hoisted(() => ({ current: null as null | FakeStripe }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    transfers: {
      create: (req: LegTransferRequest, opts: { idempotencyKey: string }) => sdk.current!.createTransfer(req, opts.idempotencyKey),
      list: async (p: { transfer_group: string }) => sdk.current!.listTransfersByGroup(p.transfer_group),
    },
    accounts: { retrieve: async () => ({ capabilities: { transfers: "active" } }) },
    paymentIntents: { retrieve: async () => ({ status: "succeeded", latest_charge: `ch_${stamp}` }) },
  }),
}))

/** Splits a migration into statements, keeping $$ function bodies whole. */
function splitSql(sql: string): string[] {
  const out: string[] = []
  let cur = ""
  let inDollar = false
  const lines = sql.split("\n")
  for (const line of lines) {
    if (!inDollar && line.trim().startsWith("--")) continue
    cur += line + "\n"
    const dollars = (line.match(/\$\$/g) ?? []).length
    if (dollars % 2 === 1) inDollar = !inDollar
    if (!inDollar && line.trim().endsWith(";")) {
      out.push(cur.trim())
      cur = ""
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const ROOT = join(__dirname, "..", "..")
const MIGRATION = readFileSync(join(ROOT, "prisma/migrations/20261125090000_payout_leg_registry/migration.sql"), "utf8")
const DOWN = readFileSync(join(ROOT, "scripts/migration-rollbacks/20261125090000_payout_leg_registry.down.sql"), "utf8")

describe.skipIf(!RUN_DB)("payout leg registry — real PostgreSQL, real Prisma", { timeout: 180_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let svc: typeof import("@/lib/payouts/leg-transfer.server")
  let model: typeof import("@/lib/payouts/leg-model")

  const users: string[] = []
  const orders: string[] = []
  const products: string[] = []
  const listings: string[] = []

  async function applySql(sql: string) {
    for (const stmt of splitSql(sql)) await prisma.$executeRawUnsafe(stmt)
  }

  function svcInput(legKey: string, over: Partial<Parameters<typeof svc.executeLegTransfer>[0]> = {}, fake?: FakeStripe, now?: Date) {
    const orderId = legKey.split(":")[1]
    return {
      legKey,
      kind: "order" as const,
      role: (legKey.split(":")[2] ?? "SUPPLIER") as "SUPPLIER",
      rail: "process_transfers" as const,
      orderId,
      transferGroup: orderId,
      params: { amountCents: 1000, currency: "eur", destination: "acct_SUP", sourceTransaction: null },
      deps: { db: prisma as never, stripe: fake, ...(now ? { now: () => now } : {}) },
      ...over,
    }
  }

  const legKey = (name: string, role = "SUPPLIER") => `order:${stamp}${name}:${role}`
  const legRow = (key: string) => prisma.payoutLeg.findUnique({ where: { legKey: key } })

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    svc = await import("@/lib/payouts/leg-transfer.server")
    model = await import("@/lib/payouts/leg-model")
    // The registry exactly as the migration builds it (the CI schema comes from the datamodel: no CHECK, no trigger).
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "PayoutLeg" CASCADE`)
    await applySql(MIGRATION)
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('affisell.payout_leg_purge', 'on', true)`)
      await tx.$executeRawUnsafe(`DELETE FROM "PayoutLeg" WHERE "legKey" LIKE '%${stamp}%'`)
    })
    await prisma.merchantPayoutLedger.deleteMany({ where: { OR: [{ orderId: { in: orders } }, { userId: { in: users } }] } })
    await prisma.notification.deleteMany({ where: { orderId: { in: orders } } })
    await prisma.transferAttempt.deleteMany({ where: { orderId: { in: orders } } })
    await prisma.auditLog.deleteMany({ where: { entityId: { contains: stamp } } })
    await prisma.order.deleteMany({ where: { id: { in: orders } } })
    await prisma.affiliateProduct.deleteMany({ where: { id: { in: listings } } })
    await prisma.product.deleteMany({ where: { id: { in: products } } })
    await prisma.supplierProfile.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
  })

  // ---------------------------------------------------------------------------------------------------------------
  it("1. two workers on the same leg: one transfer, the other is busy", async () => {
    const fake = new FakeStripe()
    fake.delayMs = 400
    const key = legKey("s1")
    const outcomes = await Promise.all([svc.executeLegTransfer(svcInput(key, {}, fake)), svc.executeLegTransfer(svcInput(key, {}, fake))])
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(["busy", "paid"])
    expect(fake.createCalls).toBe(1)
    expect(fake.transfers).toHaveLength(1)
    expect((await legRow(key))?.state).toBe("PAID")
  })

  it("1b. five concurrent workers: still one transfer", async () => {
    const fake = new FakeStripe()
    fake.delayMs = 300
    const key = legKey("s1b")
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => svc.executeLegTransfer(svcInput(key, {}, fake))))
    expect(outcomes.filter((o) => o.outcome === "paid")).toHaveLength(1)
    expect(fake.transfers).toHaveLength(1)
  })

  it("2 + 12. Stripe creates the transfer but the response is lost: IN_DOUBT, never re-sent, then adopted", async () => {
    const fake = new FakeStripe()
    fake.modes = ["lost_response"]
    const key = legKey("s2")
    const first = await svc.executeLegTransfer(svcInput(key, {}, fake))
    expect(first.outcome).toBe("in_doubt")
    expect((await legRow(key))?.state).toBe("IN_DOUBT")
    const second = await svc.executeLegTransfer(svcInput(key, { rail: "lightning" }, fake))
    expect(second.outcome).toBe("in_doubt")
    expect(fake.createCalls).toBe(1)
    // One ops alert on ENTERING the doubt, whatever the rail; asking again does not re-alert.
    expect(ops.alerts.filter((a) => a.includes(key))).toHaveLength(1)

    const rec = await svc.reconcileLeg(key, { actor: "test-admin", deps: { db: prisma as never, stripe: fake } })
    expect(rec).toEqual({ result: "adopted", stripeTransferId: fake.transfers[0].id })
    const after = await svc.executeLegTransfer(svcInput(key, {}, fake))
    expect(after).toMatchObject({ outcome: "already_paid", stripeTransferId: fake.transfers[0].id, amountCents: 1000 })
    expect(fake.transfers).toHaveLength(1)
    expect(await prisma.auditLog.count({ where: { action: "payout_leg.adopted", entityId: key } })).toBe(1)
  })

  it("3. the process dies after Stripe created the transfer, before recording it: lease expiry → IN_DOUBT, no second transfer", async () => {
    const fake = new FakeStripe()
    fake.modes = ["hang"]
    const key = legKey("s3")
    const t0 = new Date()
    const dying = svc.executeLegTransfer(svcInput(key, {}, fake, t0)) // will be "killed": its result is ignored until the end
    await vi.waitFor(() => expect(fake.transfers).toHaveLength(1))
    expect((await legRow(key))?.state).toBe("PROCESSING")

    const later = new Date(t0.getTime() + model.PAYOUT_LEG_LEASE_MS + 1000)
    const retry = await svc.executeLegTransfer(svcInput(key, {}, fake, later))
    expect(retry).toEqual({ outcome: "in_doubt", reason: "claim_lease_expired" })
    expect(fake.createCalls).toBe(1)

    // The "dead" worker wakes up: its claim is gone, it can not record — the leg stays IN_DOUBT.
    fake.releaseHang()
    expect(await dying).toEqual({ outcome: "in_doubt", reason: "claim_lost_after_transfer" })
    expect((await legRow(key))?.state).toBe("IN_DOUBT")
    expect((await svc.reconcileLeg(key, { actor: "t", deps: { db: prisma as never, stripe: fake, now: () => later } })).result).toBe("adopted")
    expect(fake.transfers).toHaveLength(1)
  })

  it("4. days after the Stripe key expired: a transfer made earlier is found, never re-created", async () => {
    // (a) transfer made by a pre-registry rail (old key `transfer_<order>_SUPPLIER`, old metadata), keys long expired
    const fake = new FakeStripe()
    const order = `${stamp}s4`
    fake.transfers.push({
      id: fake.newId(),
      amount: 1000,
      currency: "eur",
      destination: "acct_SUP",
      transfer_group: order,
      metadata: { orderId: order, role: "SUPPLIER" },
      created: 1,
    })
    const later = new Date(Date.now() + 5 * DAY)
    const adopted = await svc.executeLegTransfer(svcInput(`order:${order}:SUPPLIER`, {}, fake, later))
    expect(adopted).toMatchObject({ outcome: "paid", stripeTransferId: fake.transfers[0].id })
    expect(fake.createCalls).toBe(0)

    // (b) lost response, then the key expires: a retry 3 days later still creates nothing, and nobody can confirm "not paid"
    const fake2 = new FakeStripe()
    fake2.modes = ["lost_response"]
    const key = legKey("s4b")
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake2))).outcome).toBe("in_doubt")
    fake2.expireKeys()
    const days = new Date(Date.now() + 3 * DAY)
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake2, days))).outcome).toBe("in_doubt")
    const confirm = await svc.confirmLegNotPaid(key, {
      actor: "test-admin",
      note: "checked the dashboard, nothing there",
      deps: { db: prisma as never, stripe: fake2, now: () => days },
    })
    expect(confirm).toEqual({ result: "refused", reason: "search_adopt" })
    expect(fake2.transfers).toHaveLength(1)
    expect(fake2.createCalls).toBe(1)
  })

  it("8. other parameters for the same leg are refused; Stripe's idempotency refusal is a doubt", async () => {
    const fake = new FakeStripe()
    fake.modes = ["rate_limit"]
    const key = legKey("s8")
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake))).outcome).toBe("retry_later")
    expect((await legRow(key))).toMatchObject({ state: "PENDING", amountCents: 1000 })
    const other = await svc.executeLegTransfer(
      svcInput(key, { rail: "lightning", params: { amountCents: 1200, currency: "eur", destination: "acct_SUP", sourceTransaction: null } }, fake)
    )
    expect(other).toEqual({ outcome: "params_changed" })
    expect(fake.createCalls).toBe(1)
    // The same rail with the frozen parameters goes through, with the same key.
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake))).outcome).toBe("paid")
    expect(fake.transfers).toHaveLength(1)

    // Stripe already knows this key with another body: that request may have created a transfer → doubt.
    const fake2 = new FakeStripe()
    const key2 = legKey("s8b")
    fake2.keys.set(model.legIdempotencyKey(key2, 1), { body: "{}", id: "tr_ghost" })
    expect((await svc.executeLegTransfer(svcInput(key2, {}, fake2))).outcome).toBe("in_doubt")

    // A direct write of other parameters in the same generation is refused by the database itself.
    await expect(prisma.payoutLeg.update({ where: { legKey: key2 }, data: { paramsHash: "forged" } })).rejects.toThrow(/frozen parameters/)
  })

  it("9. a network error: IN_DOUBT, no automatic retry; a person confirms after a complete search; generation 2 pays once", async () => {
    const fake = new FakeStripe()
    fake.modes = ["connection_error"]
    const key = legKey("s9")
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake))).outcome).toBe("in_doubt")
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake))).outcome).toBe("in_doubt")
    expect(fake.createCalls).toBe(1)

    const tooSoon = await svc.confirmLegNotPaid(key, { actor: "a", note: "nothing in Stripe dashboard", deps: { db: prisma as never, stripe: fake } })
    expect(tooSoon).toEqual({ result: "refused", reason: "too_soon" })
    const later = new Date(Date.now() + 2 * HOUR)
    const ok = await svc.confirmLegNotPaid(key, { actor: "a", note: "nothing in Stripe dashboard", deps: { db: prisma as never, stripe: fake, now: () => later } })
    expect(ok).toEqual({ result: "confirmed" })
    const paid = await svc.executeLegTransfer(svcInput(key, {}, fake, later))
    expect(paid).toMatchObject({ outcome: "paid", generation: 2 })
    expect([...fake.keys.keys()]).toEqual([model.legIdempotencyKey(key, 2)])
    expect(fake.transfers).toHaveLength(1)
    expect(await prisma.auditLog.count({ where: { action: "payout_leg.confirmed_not_paid", entityId: key } })).toBe(1)
  })

  it("10. a confirmed Stripe refusal can be retried, under a new generation, once", async () => {
    const fake = new FakeStripe()
    fake.modes = ["refuse"]
    const key = legKey("s10")
    expect(await svc.executeLegTransfer(svcInput(key, {}, fake))).toMatchObject({ outcome: "failed_confirmed", errorCode: "balance_insufficient" })
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake))).outcome).toBe("paid")
    expect((await svc.executeLegTransfer(svcInput(key, {}, fake))).outcome).toBe("already_paid")
    expect(fake.transfers).toHaveLength(1)
    expect((await legRow(key))).toMatchObject({ state: "PAID", generation: 2 })
  })

  it("11. Légion: a ledger conflict AFTER the transfer was created leaves the leg IN_DOUBT — never a second transfer", async () => {
    const fake = new FakeStripe()
    const sponsor = (await prisma.user.create({ data: { email: `lg-sp-${stamp}@affisell.test`, role: "AFFILIATE", name: "SP" } })).id
    users.push(sponsor)
    const order = `${stamp}s11`
    const { insertPayoutLedgerRow } = await import("@/lib/payout-ledger")
    // An earlier, different entry already holds the ledger key.
    await prisma.merchantPayoutLedger.create({
      data: {
        orderId: null,
        userId: sponsor,
        beneficiaryRole: "LEGION_SPONSOR",
        entryType: "LEGION_OVERRIDE",
        amountCents: 400,
        idempotencyKey: `legion_override_${order}`,
        payoutRail: "connect",
      },
    })
    const input = svcInput(`order:${order}:LEGION_SPONSOR`, {
      role: "LEGION_SPONSOR",
      rail: "legion",
      params: { amountCents: 500, currency: "eur", destination: "acct_SPONSOR", sourceTransaction: null },
      onPaid: (tx, paid) =>
        insertPayoutLedgerRow(tx, {
          orderId: null,
          blindDropshipOrderId: null,
          userId: sponsor,
          beneficiaryRole: "LEGION_SPONSOR",
          entryType: "LEGION_OVERRIDE",
          amountCents: 500,
          idempotencyKey: `legion_override_${order}`,
          stripeTransferId: paid.stripeTransferId,
          payoutRail: "connect",
          note: null,
        }).then(() => undefined),
    }, fake)
    expect(await svc.executeLegTransfer(input)).toEqual({ outcome: "in_doubt", reason: "record_failed_after_transfer" })
    expect(await svc.executeLegTransfer(input)).toMatchObject({ outcome: "in_doubt" })
    expect(fake.transfers).toHaveLength(1)
    expect(fake.createCalls).toBe(1)
    // Nothing half-written: the ledger still holds only the earlier entry.
    expect(await prisma.merchantPayoutLedger.count({ where: { idempotencyKey: `legion_override_${order}` } })).toBe(1)
  })

  it("the database refuses what the code must never do", async () => {
    const key = legKey("s1")
    await expect(prisma.payoutLeg.update({ where: { legKey: key }, data: { state: "PENDING", stripeTransferId: null, paidAt: null } })).rejects.toThrow()
    await expect(prisma.payoutLeg.delete({ where: { legKey: key } })).rejects.toThrow(/never deleted/)
    await expect(prisma.$executeRawUnsafe(`TRUNCATE "PayoutLeg"`)).rejects.toThrow(/never truncated/)
    const doubt = legKey("s9b")
    await prisma.payoutLeg.create({
      data: { legKey: doubt, kind: "order", orderId: `${stamp}s9b`, role: "SUPPLIER", state: "IN_DOUBT", transferGroup: `${stamp}s9b`, inDoubtReason: "t", inDoubtAt: new Date() },
    })
    await expect(prisma.payoutLeg.update({ where: { legKey: doubt }, data: { state: "PENDING" } })).rejects.toThrow(/refused/)
    await expect(prisma.payoutLeg.update({ where: { legKey: doubt }, data: { state: "FAILED_CONFIRMED" } })).rejects.toThrow(/resolvedBy/)
  })

  // ---------------------------------------------------------------------------------------------------------------
  describe("5 / 6 / 7. Lightning and process-transfers on real orders", () => {
    const acct = { sup: `acct_${stamp}S`, aff: `acct_${stamp}A` }
    let supplier = ""
    let affiliate = ""

    async function makeOrder(tag: string) {
      const product = (await prisma.product.create({ data: { supplierId: supplier, name: `LG ${tag}`, description: "d", basePriceCents: 2000, commissionRate: 10 } as never })).id
      products.push(product)
      const listing = (await prisma.affiliateProduct.create({ data: { affiliateId: affiliate, productId: product, sellingPriceCents: 3000 } as never })).id
      listings.push(listing)
      const order = (
        await prisma.order.create({
          data: {
            productId: product,
            affiliateProductId: listing,
            supplierId: supplier,
            affiliateId: affiliate,
            customerEmail: `buyer-${stamp}-${tag}@affisell.test`,
            shippingAddress: { country: "FR" },
            stripeSessionId: `cs_${stamp}${tag}:line:0`,
            stripePaymentIntentId: `pi_${stamp}${tag}`,
            stripeChargeId: `ch_${stamp}${tag}`,
            basePriceCents: 2000,
            supplierPriceCents: 2000,
            sellingPriceCents: 3000,
            subtotalCents: 3000,
            totalCents: 3600,
            taxCents: 600,
            commissionCents: 200,
            marginCents: 1000,
            affiliateMarginCents: 1000,
            supplierPayoutCents: 1500,
            affiliatePayoutCents: 200,
            paidAt: new Date(),
          } as never,
        })
      ).id
      orders.push(order)
      await prisma.transferAttempt.createMany({
        data: [
          { orderId: order, role: "SUPPLIER", amountCents: 1500, destination: acct.sup, status: "PENDING" },
          { orderId: order, role: "AFFILIATE", amountCents: 200, destination: acct.aff, status: "PENDING" },
        ],
      })
      return order
    }

    beforeAll(async () => {
      supplier = (await prisma.user.create({ data: { email: `lg-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "S", stripeAccountId: acct.sup } as never })).id
      affiliate = (await prisma.user.create({ data: { email: `lg-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "A", stripeAccountId: acct.aff } as never })).id
      users.push(supplier, affiliate)
      await prisma.supplierProfile.create({ data: { userId: supplier, trustScore: 90, lightningEnabled: true } })
    })

    it("5. Lightning after process-transfers paid the supplier leg: the supplier is NOT paid twice (risk A3)", async () => {
      const fake = new FakeStripe()
      sdk.current = fake
      const order = await makeOrder("a3")
      const { runProcessTransfersJob } = await import("@/lib/transfers/process-transfers")
      const { triggerLightningPayout } = await import("@/lib/stripe-lightning")

      gate.eligibleRoles = new Set(["SUPPLIER"]) // shipped: supplier released, reseller still held
      await runProcessTransfersJob({ orderId: order })
      expect(fake.inGroup(order)).toHaveLength(1)

      gate.eligibleRoles = new Set(["SUPPLIER", "AFFILIATE"])
      expect(await triggerLightningPayout(order)).toEqual({ success: true })
      const transfers = fake.inGroup(order)
      expect(transfers).toHaveLength(2)
      expect(transfers.map((t) => t.metadata.affisell_leg_key).sort()).toEqual([
        `order:${order}:AFFILIATE`,
        `order:${order}:SUPPLIER`,
      ])

      // Records: one SUCCESS attempt and one ledger row per leg, order PAID.
      const attempts = await prisma.transferAttempt.findMany({ where: { orderId: order } })
      expect(attempts.every((a) => a.status === "SUCCESS")).toBe(true)
      expect(await prisma.merchantPayoutLedger.count({ where: { orderId: order, entryType: "PAYOUT" } })).toBe(2)
      expect((await prisma.order.findUnique({ where: { id: order } }))?.payoutStatus).toBe("PAID")

      // Replays change nothing.
      await runProcessTransfersJob({ orderId: order })
      await triggerLightningPayout(order)
      expect(fake.inGroup(order)).toHaveLength(2)
      expect(await prisma.merchantPayoutLedger.count({ where: { orderId: order, entryType: "PAYOUT" } })).toBe(2)
    })

    it("6. process-transfers after Lightning paid both legs: nothing more is created", async () => {
      const fake = new FakeStripe()
      sdk.current = fake
      const order = await makeOrder("l1")
      const { runProcessTransfersJob } = await import("@/lib/transfers/process-transfers")
      const { triggerLightningPayout } = await import("@/lib/stripe-lightning")
      gate.eligibleRoles = new Set(["SUPPLIER", "AFFILIATE"])

      expect(await triggerLightningPayout(order)).toEqual({ success: true })
      await runProcessTransfersJob({ orderId: order })
      expect(fake.inGroup(order)).toHaveLength(2)
      expect(fake.createCalls).toBe(2)
      expect(await prisma.merchantPayoutLedger.count({ where: { orderId: order, entryType: "PAYOUT" } })).toBe(2)
    })

    it("7. Lightning and process-transfers at the same moment: one transfer per leg", async () => {
      const fake = new FakeStripe()
      fake.delayMs = 300
      sdk.current = fake
      const order = await makeOrder("c7")
      const { runProcessTransfersJob } = await import("@/lib/transfers/process-transfers")
      const { triggerLightningPayout } = await import("@/lib/stripe-lightning")
      gate.eligibleRoles = new Set(["SUPPLIER", "AFFILIATE"])

      await Promise.all([triggerLightningPayout(order), runProcessTransfersJob({ orderId: order })])
      // Whatever interleaving happened, finish the job (a busy leg is retried by the next run).
      await runProcessTransfersJob({ orderId: order })
      const transfers = fake.inGroup(order)
      expect(transfers).toHaveLength(2)
      expect(new Set(transfers.map((t) => t.metadata.affisell_leg_key)).size).toBe(2)
      expect(await prisma.merchantPayoutLedger.count({ where: { orderId: order, entryType: "PAYOUT" } })).toBe(2)
    })

    it("a legacy SUCCESS attempt (paid before the registry) is adopted and never re-paid by Lightning", async () => {
      const fake = new FakeStripe()
      sdk.current = fake
      const order = await makeOrder("lg")
      await prisma.transferAttempt.update({
        where: { orderId_role: { orderId: order, role: "SUPPLIER" } },
        data: { status: "SUCCESS", stripeTransferId: `tr_${stamp}legacy` },
      })
      const { triggerLightningPayout } = await import("@/lib/stripe-lightning")
      gate.eligibleRoles = new Set(["SUPPLIER", "AFFILIATE"])
      expect(await triggerLightningPayout(order)).toEqual({ success: true })
      expect(fake.inGroup(order).map((t) => t.metadata.affisell_role)).toEqual(["AFFILIATE"])
      expect((await legRow(`order:${order}:SUPPLIER`))).toMatchObject({ state: "PAID", adopted: true, stripeTransferId: `tr_${stamp}legacy` })
      // No ledger row invented for the legacy transfer (historical gaps are settled by hand, docs §8).
      expect(await prisma.merchantPayoutLedger.count({ where: { orderId: order, beneficiaryRole: "SUPPLIER" } })).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------------------------------------------
  it("rollback script drops the registry; the migration reinstalls it", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('affisell.payout_leg_purge', 'on', true)`)
      await tx.$executeRawUnsafe(`DELETE FROM "PayoutLeg" WHERE "legKey" LIKE '%${stamp}%'`)
    })
    await applySql(DOWN)
    const gone = await prisma.$queryRawUnsafe<{ r: string | null }[]>(`SELECT to_regclass('"PayoutLeg"')::text AS r`)
    expect(gone[0].r).toBeNull()
    await applySql(MIGRATION)
    const back = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM pg_trigger WHERE tgrelid = '"PayoutLeg"'::regclass AND NOT tgisinternal`
    )
    expect(Number(back[0].n)).toBe(2)
  })
})
