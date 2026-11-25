/**
 * Payout ledger replays on a REAL PostgreSQL through the REAL Prisma engine (2026-11-25).
 *
 * Part 1 MEASURES what Prisma does with the former code (`create` + catch P2002 inside an interactive transaction) —
 * the diagnosis, printed as `[prisma-behaviour]` lines in the CI log.
 * Part 2 proves the fix: a replay answers "already recorded" WITHOUT rolling back the caller's other writes, no
 * duplicate row, a real accounting conflict or a real database error is never hidden, concurrent writers end with one
 * row. The unique index on stripeTransferId is recreated PARTIAL, as it is on staging and production (read-only check
 * of 2026-11-25), not the plain one the CI schema builds from the datamodel.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = `pl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

describe.skipIf(!RUN_DB)("payout ledger replays — real PostgreSQL, real Prisma", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let ledger: typeof import("@/lib/payout-ledger")
  let settlement: typeof import("@/lib/payout-settlement")
  const ids = { supplier: "", affiliate: "", product: "", listing: "", order: "", attempt: "" }
  const transferId = `tr_${stamp}`

  const ledgerRows = (where: Record<string, unknown> = {}) =>
    prisma.merchantPayoutLedger.count({ where: { orderId: ids.order, ...where } })
  const notifications = () => prisma.notification.count({ where: { orderId: ids.order } })

  /** The code as it was before 2026-11-25 (lib/payout-ledger.ts): create, then catch P2002 as "already recorded". */
  async function formerRecord(tx: never, key: string, transfer: string | null): Promise<boolean> {
    try {
      await (tx as typeof prisma).merchantPayoutLedger.create({
        data: {
          orderId: ids.order,
          userId: ids.supplier,
          beneficiaryRole: "SUPPLIER",
          entryType: "PAYOUT",
          amountCents: 1500,
          idempotencyKey: key,
          stripeTransferId: transfer,
          payoutRail: "connect",
          note: "former",
        },
      })
      return true
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") return false
      throw e
    }
  }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ledger = await import("@/lib/payout-ledger")
    settlement = await import("@/lib/payout-settlement")

    // Production shape of the index (partial), whatever the CI schema built.
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "MerchantPayoutLedger_stripeTransferId_key"`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "MerchantPayoutLedger_stripeTransferId_key" ON "MerchantPayoutLedger"("stripeTransferId") WHERE "stripeTransferId" IS NOT NULL`
    )

    ids.supplier = (await prisma.user.create({ data: { email: `pl-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "S" } })).id
    ids.affiliate = (await prisma.user.create({ data: { email: `pl-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "A" } })).id
    ids.product = (await prisma.product.create({ data: { supplierId: ids.supplier, name: "PL", description: "d", basePriceCents: 2000, commissionRate: 10 } as never })).id
    ids.listing = (await prisma.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 3000 } as never })).id
    ids.order = (
      await prisma.order.create({
        data: {
          productId: ids.product,
          affiliateProductId: ids.listing,
          supplierId: ids.supplier,
          affiliateId: ids.affiliate,
          customerEmail: `buyer-${stamp}@affisell.test`,
          shippingAddress: { country: "FR" },
          stripeSessionId: `cs_${stamp}:line:0`,
          basePriceCents: 2000,
          supplierPriceCents: 2000,
          sellingPriceCents: 3000,
          subtotalCents: 3000,
          totalCents: 3600,
          taxCents: 600,
          commissionCents: 200,
          marginCents: 1000,
          affiliateMarginCents: 1000,
          affiliatePayoutCents: 200,
          paidAt: new Date(),
        } as never,
      })
    ).id
    ids.attempt = (
      await prisma.transferAttempt.create({
        data: { orderId: ids.order, role: "SUPPLIER", amountCents: 1500, destination: "acct_test", status: "PENDING" } as never,
      })
    ).id
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.merchantPayoutLedger.deleteMany({ where: { orderId: ids.order } })
    await prisma.notification.deleteMany({ where: { orderId: ids.order } })
    await prisma.transferAttempt.deleteMany({ where: { orderId: ids.order } })
    await prisma.order.deleteMany({ where: { id: ids.order } })
    await prisma.affiliateProduct.deleteMany({ where: { id: ids.listing } })
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate] } } })
    await prisma.$disconnect()
  })

  const settle = (tx: never, transfer = transferId, amountCents = 1500) =>
    settlement.recordStripePayoutSettlement(tx, {
      orderId: ids.order,
      beneficiaryRole: "SUPPLIER",
      userId: ids.supplier,
      amountCents,
      stripeTransferId: transfer,
      payoutRail: "connect",
      productName: "PL",
    })

  it("first payout: ledger row, order timestamp, notification and the caller's own write, all committed", async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.transferAttempt.update({ where: { id: ids.attempt }, data: { status: "SUCCESS", stripeTransferId: transferId } })
      return settle(tx as never)
    })
    expect(result).toBe(true)
    expect(await ledgerRows()).toBe(1)
    expect(await notifications()).toBe(1)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: ids.order }, select: { supplierPayoutAt: true } })
    expect(order.supplierPayoutAt).not.toBeNull()
    expect((await prisma.transferAttempt.findUniqueOrThrow({ where: { id: ids.attempt } })).status).toBe("SUCCESS")
  })

  describe("diagnosis — the former code (create + catch P2002) on the real Prisma engine", () => {
    it("A1: caught P2002 and the callback ends — the caller's earlier write is LOST", async () => {
      await prisma.transferAttempt.update({ where: { id: ids.attempt }, data: { status: "PENDING" } })
      let rejected: string | null = null
      let answered: boolean | null = null
      try {
        answered = await prisma.$transaction(async (tx) => {
          await tx.transferAttempt.update({ where: { id: ids.attempt }, data: { status: "SUCCESS" } })
          return formerRecord(tx as never, `stripe:tr:${transferId}`, transferId)
        })
      } catch (e) {
        rejected = `${(e as { code?: string }).code ?? "no_code"}: ${(e as Error).message.split("\n").slice(-1)[0]}`
      }
      const status = (await prisma.transferAttempt.findUniqueOrThrow({ where: { id: ids.attempt } })).status
      console.log("[prisma-behaviour] A1", JSON.stringify({ transactionRejected: rejected, answered, attemptStatusAfter: status }))
      // Whatever Prisma reports, PostgreSQL aborted the transaction: the SUCCESS written before the replay is gone.
      expect(status).toBe("PENDING")
    })

    it("A2: caught P2002 then another write — that write is refused and the transaction fails", async () => {
      let rejected: { code?: string; message: string } | null = null
      try {
        await prisma.$transaction(async (tx) => {
          await tx.transferAttempt.update({ where: { id: ids.attempt }, data: { status: "SUCCESS" } })
          await formerRecord(tx as never, `stripe:tr:${transferId}`, transferId)
          await tx.order.update({ where: { id: ids.order }, data: { affiliatePayoutAt: new Date() } })
        })
      } catch (e) {
        rejected = { code: (e as { code?: string }).code, message: (e as Error).message.split("\n").slice(-1)[0] ?? "" }
      }
      console.log("[prisma-behaviour] A2", JSON.stringify({ transactionRejected: rejected }))
      expect(rejected).not.toBeNull()
      expect((await prisma.transferAttempt.findUniqueOrThrow({ where: { id: ids.attempt } })).status).toBe("PENDING")
      const order = await prisma.order.findUniqueOrThrow({ where: { id: ids.order }, select: { affiliatePayoutAt: true } })
      expect(order.affiliatePayoutAt).toBeNull()
    })
  })

  describe("the fix", () => {
    it("replay of the same transfer: answered 'already recorded', NO rollback, no duplicate, no second notification", async () => {
      const marker = new Date("2026-11-25T08:00:00.000Z")
      const result = await prisma.$transaction(async (tx) => {
        await tx.transferAttempt.update({ where: { id: ids.attempt }, data: { status: "SUCCESS", stripeTransferId: transferId } })
        const replay = await settle(tx as never)
        // A write AFTER the replay, in the same transaction: impossible with the former code (A2).
        await tx.order.update({ where: { id: ids.order }, data: { affiliatePayoutAt: marker } })
        return replay
      })
      expect(result).toBe(false)
      expect((await prisma.transferAttempt.findUniqueOrThrow({ where: { id: ids.attempt } })).status).toBe("SUCCESS")
      const order = await prisma.order.findUniqueOrThrow({ where: { id: ids.order }, select: { affiliatePayoutAt: true } })
      expect(order.affiliatePayoutAt?.toISOString()).toBe(marker.toISOString())
      expect(await ledgerRows()).toBe(1)
      expect(await ledgerRows({ stripeTransferId: transferId })).toBe(1)
      expect(await notifications()).toBe(1)
    })

    it("the same transfer under ANOTHER key is an accounting conflict: thrown, the whole transaction rolls back", async () => {
      await prisma.order.update({ where: { id: ids.order }, data: { affiliatePayoutAt: null } })
      const err = await prisma
        .$transaction(async (tx) => {
          await tx.order.update({ where: { id: ids.order }, data: { affiliatePayoutAt: new Date() } })
          return ledger.recordMerchantPayoutEntry(tx as never, {
            orderId: ids.order,
            userId: ids.supplier,
            beneficiaryRole: "SUPPLIER",
            amountCents: 1500,
            idempotencyKey: `another-key-${stamp}`,
            stripeTransferId: transferId,
            payoutRail: "connect",
            note: "x",
          })
        })
        .catch((e) => e)
      expect(err).toBeInstanceOf(ledger.PayoutLedgerConflictError)
      expect(err.reason).toBe("stripe_transfer_taken")
      expect(await ledgerRows()).toBe(1)
      const order = await prisma.order.findUniqueOrThrow({ where: { id: ids.order }, select: { affiliatePayoutAt: true } })
      expect(order.affiliatePayoutAt).toBeNull()
    })

    it("the same key with another amount is a conflict (never answered as a replay)", async () => {
      const err = await prisma.$transaction(async (tx) => settle(tx as never, transferId, 1499)).catch((e) => e)
      expect(err).toBeInstanceOf(ledger.PayoutLedgerConflictError)
      expect(err.reason).toBe("idempotency_key_mismatch")
      expect(err.differingFields).toEqual(["amountCents"])
      expect(await ledgerRows()).toBe(1)
    })

    it("a real database error (unknown beneficiary) is not hidden: it is thrown and nothing is written", async () => {
      const err = await prisma
        .$transaction(async (tx) =>
          ledger.recordMerchantPayoutEntry(tx as never, {
            orderId: ids.order,
            userId: `missing-user-${stamp}`,
            beneficiaryRole: "AFFILIATE",
            amountCents: 700,
            idempotencyKey: `fk-${stamp}`,
            note: "x",
          })
        )
        .catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect(err).not.toBeInstanceOf(ledger.PayoutLedgerConflictError)
      console.log("[prisma-behaviour] real-error", JSON.stringify({ code: err.code ?? null }))
      expect(await ledgerRows({ idempotencyKey: `fk-${stamp}` })).toBe(0)
    })

    it("two concurrent writers of the same entry: exactly one inserts, the other sees a replay, one row", async () => {
      const key = `concurrent-${stamp}`
      const write = () =>
        prisma.$transaction(async (tx) =>
          ledger.recordMerchantPayoutEntry(tx as never, {
            orderId: ids.order,
            userId: ids.affiliate,
            beneficiaryRole: "AFFILIATE",
            amountCents: 300,
            idempotencyKey: key,
            note: "c",
          })
        )
      const results = await Promise.all([write(), write(), write()])
      expect(results.filter(Boolean)).toHaveLength(1)
      expect(await ledgerRows({ idempotencyKey: key })).toBe(1)
    })

    it("clawback replay: recorded once, notified once, the transaction stays usable", async () => {
      const before = await notifications()
      const claw = (tx: never) =>
        settlement.recordClawbackIfPaidOut(tx, {
          orderId: ids.order,
          userId: ids.supplier,
          beneficiaryRole: "SUPPLIER",
          amountCents: 1500,
          productName: "PL",
        } as never)
      expect(await prisma.$transaction(async (tx) => claw(tx as never))).toBe(true)
      const second = await prisma.$transaction(async (tx) => {
        const r = await claw(tx as never)
        await tx.order.update({ where: { id: ids.order }, data: { affiliatePayoutAt: new Date() } })
        return r
      })
      expect(second).toBe(false)
      expect(await ledgerRows({ entryType: "CLAWBACK" })).toBe(1)
      expect(await notifications()).toBe(before + 1)
      const order = await prisma.order.findUniqueOrThrow({ where: { id: ids.order }, select: { affiliatePayoutAt: true } })
      expect(order.affiliatePayoutAt).not.toBeNull()
    })
  })
})
