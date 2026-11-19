/**
 * Procurement debit register on a REAL PostgreSQL (migration 20261119090000_procurement_debit_register). The CI schema
 * comes from the datamodel (no CHECK, no partial index, no trigger), so the test drops the two tables and applies the
 * migration's own SQL, twice (idempotent). What must hold in the DATABASE, whatever writes:
 *  - one transaction recorded once (source + reference unique);
 *  - one active allocation per (movement, order) (partial unique index);
 *  - the active allocations of a movement never exceed its settled amount — even for two concurrent writers and even
 *    for a raw INSERT that bypasses the application (trigger);
 *  - an order's cost is "real" only once every movement it touches is fully shared out.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

function statements(sql: string): string[] {
  const out: string[] = []
  let current = ""
  let inDollar = false
  for (const line of sql.replace(/^--.*$/gm, "").split("\n")) {
    current += `${line}\n`
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) inDollar = !inDollar
    if (!inDollar && line.trimEnd().endsWith(";")) {
      if (current.trim()) out.push(current.trim())
      current = ""
    }
  }
  if (current.trim()) out.push(current.trim())
  return out
}

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261119090000_procurement_debit_register/migration.sql")
const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`
const now = new Date()

describe.skipIf(!RUN_DB)("procurement debit register — real database", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let reg: typeof import("@/lib/procurement-debits/register.server")
  let pure: typeof import("@/lib/procurement-debits/register")
  const ids = { supplier: "", affiliate: "", product: "", listing: "", orders: [] as string[] }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    reg = await import("@/lib/procurement-debits/register.server")
    pure = await import("@/lib/procurement-debits/register")
    for (const t of ["ProcurementDebitAllocation", "ProcurementDebit"]) await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`)
    const parts = statements(readFileSync(MIGRATION, "utf8"))
    for (let round = 0; round < 2; round++) for (const s of parts) await prisma.$executeRawUnsafe(s)

    ids.supplier = (await prisma.user.create({ data: { email: `pd-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "S" } })).id
    ids.affiliate = (await prisma.user.create({ data: { email: `pd-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "A" } })).id
    ids.product = (await prisma.product.create({ data: { supplierId: ids.supplier, name: "PD", description: "d", basePriceCents: 2000, commissionRate: 10 } as never })).id
    ids.listing = (await prisma.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 3000 } as never })).id
    for (let i = 0; i < 3; i++) {
      const o = await prisma.order.create({
        data: {
          productId: ids.product,
          affiliateProductId: ids.listing,
          supplierId: ids.supplier,
          affiliateId: ids.affiliate,
          customerEmail: `buyer-${stamp}@affisell.test`,
          shippingAddress: { country: "FR" },
          stripeSessionId: `cs_pd_${stamp}:line:${i}`,
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
          supplierCommissionRateBps: 1000,
          affisellCommissionRateBps: 1000,
          paidAt: now,
          usesAffisellAutoBuy: true,
          aeWholesaleCents: 600,
        } as never,
      })
      ids.orders.push(o.id)
    }
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.$executeRawUnsafe(`DELETE FROM "ProcurementDebitAllocation" WHERE "orderId" = ANY($1)`, ids.orders)
    await prisma.$executeRawUnsafe(`DELETE FROM "ProcurementDebit" WHERE "sourceReference" LIKE $1 AND "parentDebitId" IS NOT NULL`, `%${stamp}%`)
    await prisma.$executeRawUnsafe(`DELETE FROM "ProcurementDebit" WHERE "sourceReference" LIKE $1`, `%${stamp}%`)
    await prisma.order.deleteMany({ where: { id: { in: ids.orders } } })
    await prisma.affiliateProduct.deleteMany({ where: { id: ids.listing } })
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate] } } })
    await prisma.$disconnect()
  })

  const record = async (over: Record<string, unknown>) => {
    const parsed = pure.parseDebitInput(
      { kind: "debit", source: "stripe_issuing", amountCents: 1300, currency: "USD", settledAmountCents: 1200, occurredAt: now.toISOString(), includesDelivery: true, vatTreatment: "included", ...over },
      new Date()
    )
    if (!parsed.ok) throw new Error(parsed.errors.join(","))
    return reg.recordProcurementDebit(parsed.value, "admin-test")
  }

  it("records a transaction once; a second record of the same reference writes nothing", async () => {
    const first = await record({ sourceReference: `ipi_dup_${stamp}` })
    expect(first.ok).toBe(true)
    const again = await record({ sourceReference: `ipi_dup_${stamp}` })
    expect(again).toMatchObject({ ok: false, error: "already_recorded", existingId: (first as { id: string }).id })
    expect(await prisma.procurementDebit.count({ where: { sourceReference: `ipi_dup_${stamp}` } })).toBe(1)
  })

  it("the database refuses a refund without its debit and a euro amount with a different settled figure", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "ProcurementDebit" ("id","kind","source","sourceReference","amountCents","currency","occurredAt","recordedById") VALUES ('x_${stamp}','refund','bank_statement','r_${stamp}',10,'EUR',now(),'a')`
      )
    ).rejects.toThrow(/ProcurementDebit_parent_check|ProcurementDebit_eur_settled_check/)
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "ProcurementDebit" ("id","kind","source","sourceReference","amountCents","currency","settledAmountCents","settledCurrency","occurredAt","recordedById") VALUES ('y_${stamp}','debit','bank_statement','e_${stamp}',1000,'EUR',900,'EUR',now(),'a')`
      )
    ).rejects.toThrow(/ProcurementDebit_eur_settled_check/)
  })

  it("a grouped debit is shared out; over-allocation is refused by the code AND by the trigger, even concurrently", async () => {
    const d = (await record({ sourceReference: `ipi_group_${stamp}` })) as { ok: true; id: string }
    const [o1, o2, o3] = ids.orders as [string, string, string]
    expect(await reg.allocateProcurementDebit(d.id, { orderId: o1, amountCents: 700, basis: "grouped_split", note: "" }, "admin-test")).toMatchObject({ ok: true, remainingAfterCents: 500 })
    expect(await reg.allocateProcurementDebit(d.id, { orderId: o1, amountCents: 1, basis: "grouped_split", note: "" }, "admin-test")).toMatchObject({ ok: false, error: "already_allocated_to_order" })
    // Two concurrent allocations of 400 against 500 left: exactly one wins.
    const both = await Promise.all([
      reg.allocateProcurementDebit(d.id, { orderId: o2, amountCents: 400, basis: "grouped_split", note: "" }, "admin-test"),
      reg.allocateProcurementDebit(d.id, { orderId: o3, amountCents: 400, basis: "grouped_split", note: "" }, "admin-test"),
    ])
    expect(both.filter((r) => r.ok)).toHaveLength(1)
    expect(both.find((r) => !r.ok)).toMatchObject({ error: "over_allocated" })
    // A raw INSERT that bypasses the application is stopped by the trigger.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "ProcurementDebitAllocation" ("id","debitId","orderId","amountCents","basis","allocatedById") VALUES ('raw_${stamp}','${d.id}','raw-order-${stamp}',200,'manual','a')`
      )
    ).rejects.toThrow(/procurement_debit_over_allocated/)
    const total = await prisma.procurementDebitAllocation.aggregate({ where: { debitId: d.id, status: "active" }, _sum: { amountCents: true } })
    expect(total._sum.amountCents).toBe(1100)
  })

  it("an order's cost is real only once every movement it touches is fully shared out; refunds never exceed its share", async () => {
    const [o1] = ids.orders as [string]
    const d = (await record({ sourceReference: `ipi_full_${stamp}`, amountCents: 800, settledAmountCents: 740 })) as { ok: true; id: string }
    expect(await reg.allocateProcurementDebit(d.id, { orderId: o1, amountCents: 740, basis: "single_order", note: "" }, "admin-test")).toMatchObject({ ok: true })
    let view = (await reg.loadOrderCostReconciliations([{ id: o1, storedSourcePriceCents: 600 }])) as { available: true; byOrder: Map<string, { status: string; realFullCostCents: number | null; reasons: string[] }> }
    // o1 also holds 700 of the grouped debit, which still has 100 unallocated → incomplete, no real cost.
    expect(view.byOrder.get(o1)).toMatchObject({ status: "incomplete", realFullCostCents: null })

    const refund = (await record({ kind: "refund", sourceReference: `ipr_full_${stamp}`, amountCents: 100, settledAmountCents: 90, parentDebitId: d.id })) as { ok: true; id: string }
    expect(await reg.allocateProcurementDebit(refund.id, { orderId: ids.orders[1]!, amountCents: 90, basis: "single_order", note: "" }, "admin-test")).toMatchObject({ ok: false, error: "parent_not_allocated_to_order" })
    expect(await reg.allocateProcurementDebit(refund.id, { orderId: o1, amountCents: 90, basis: "single_order", note: "" }, "admin-test")).toMatchObject({ ok: true })

    // Revoke o1's share of the grouped debit: o1 is then covered by the fully allocated debit + its refund only.
    const grouped = await prisma.procurementDebit.findFirstOrThrow({ where: { sourceReference: `ipi_group_${stamp}` }, select: { id: true } })
    const share = await prisma.procurementDebitAllocation.findFirstOrThrow({ where: { debitId: grouped.id, orderId: o1, status: "active" }, select: { id: true } })
    expect(await reg.revokeProcurementAllocation(share.id, "erreur de rattachement", "admin-test")).toEqual({ ok: true })
    view = (await reg.loadOrderCostReconciliations([{ id: o1, storedSourcePriceCents: 600 }])) as typeof view
    expect(view.byOrder.get(o1)).toMatchObject({ status: "reconciled", realFullCostCents: 650 })
  })

  it("voiding keeps the row, revokes its allocations, and is refused while a refund still points at the debit", async () => {
    const full = await prisma.procurementDebit.findFirstOrThrow({ where: { sourceReference: `ipi_full_${stamp}` }, select: { id: true } })
    expect(await reg.voidProcurementDebit(full.id, "saisie en double", "admin-test")).toEqual({ ok: false, error: "has_recorded_children" })
    const refund = await prisma.procurementDebit.findFirstOrThrow({ where: { sourceReference: `ipr_full_${stamp}` }, select: { id: true } })
    expect(await reg.voidProcurementDebit(refund.id, "saisie en double", "admin-test")).toMatchObject({ ok: true, revokedAllocations: 1 })
    expect(await reg.voidProcurementDebit(full.id, "saisie en double", "admin-test")).toMatchObject({ ok: true, revokedAllocations: 1 })
    expect(await prisma.procurementDebit.findUnique({ where: { id: full.id }, select: { status: true } })).toEqual({ status: "voided" })
    expect(await reg.allocateProcurementDebit(full.id, { orderId: ids.orders[2]!, amountCents: 1, basis: "single_order", note: "" }, "admin-test")).toMatchObject({ ok: false, error: "movement_voided" })
  })
})
