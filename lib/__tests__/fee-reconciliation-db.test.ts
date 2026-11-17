/**
 * `report:fee-reconciliation` on a REAL PostgreSQL: the proofs that the read scope can not write.
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/fee-reconciliation-db.test.ts
 * (1) PostgreSQL itself refuses a write inside the report's transaction (an UNGUARDED client is used on purpose);
 * (2) the guarded client refuses writes before they reach the database;
 * (3) the real query groups a cart's siblings by their base Checkout Session and keeps the one stored charge id;
 * (4) after a run, no row it read has changed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`
const cart = `cs_recon_${stamp}`

describe.skipIf(!RUN_DB)("fee reconciliation — real database", { timeout: 120_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let base: any
  let run: typeof import("@/lib/strategic-intelligence/fee-reconciliation-run")
  const ids = { supplier: "", affiliate: "", product: "", listing: "", orders: [] as string[] }

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client")
    run = await import("@/lib/strategic-intelligence/fee-reconciliation-run")
    base = new PrismaClient({ log: [] })
    ids.supplier = (await base.user.create({ data: { email: `recon-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "S" } })).id
    ids.affiliate = (await base.user.create({ data: { email: `recon-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "A" } })).id
    ids.product = (await base.product.create({ data: { supplierId: ids.supplier, name: "Recon", description: "d", basePriceCents: 2000, commissionRate: 10 } })).id
    ids.listing = (await base.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 3000 } })).id
    const order = async (session: string, over: Record<string, unknown>) =>
      (
        await base.order.create({
          data: {
            productId: ids.product,
            affiliateProductId: ids.listing,
            supplierId: ids.supplier,
            affiliateId: ids.affiliate,
            customerEmail: `buyer-${stamp}@affisell.test`,
            shippingAddress: { country: "FR" },
            stripeSessionId: session,
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
            paidAt: new Date(),
            ...over,
          } as never,
        })
      ).id
    ids.orders.push(await order(`${cart}:line:0`, { stripeChargeId: `ch_recon_${stamp}` }))
    ids.orders.push(await order(`${cart}:line:1`, {}))
    ids.orders.push(await order(`cs_single_${stamp}`, { stripePaymentIntentId: `pi_recon_${stamp}` }))
  }, 60_000)

  afterAll(async () => {
    if (!base) return
    await base.order.deleteMany({ where: { id: { in: ids.orders } } })
    await base.affiliateProduct.deleteMany({ where: { id: ids.listing } })
    await base.product.deleteMany({ where: { id: ids.product } })
    await base.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate] } } })
    await base.$disconnect()
  })

  it("PostgreSQL itself refuses a write inside the report's transaction (unguarded client, on purpose)", async () => {
    await expect(
      run.withReadOnlyTransaction(base, (tx) => tx.$executeRawUnsafe(`UPDATE "Order" SET "taxCents" = "taxCents" + 1 WHERE "id" = '${ids.orders[0]}'`))
    ).rejects.toThrow(/read-only transaction/)
    await expect(
      run.withReadOnlyTransaction(base, (tx) => tx.$executeRawUnsafe(`INSERT INTO "AffisellTrackEvent" ("id","eventType","createdAt") VALUES ('recon_${stamp}','recon',now())`))
    ).rejects.toThrow(/read-only transaction/)
    await expect(run.withReadOnlyTransaction(base, (tx) => tx.order.update({ where: { id: ids.orders[0]! }, data: { taxCents: 601 } }))).rejects.toThrow(/read-only transaction/)
    expect((await base.order.findUnique({ where: { id: ids.orders[0] }, select: { taxCents: true } })).taxCents).toBe(600)
  })

  it("the guarded client refuses a write before the database sees it", async () => {
    const guarded = run.readOnlyPrismaClient(base)
    await expect(guarded.order.update({ where: { id: ids.orders[0]! }, data: { taxCents: 601 } })).rejects.toThrow("reconciliation_write_refused:update")
    await expect(guarded.$executeRawUnsafe("SELECT 1")).rejects.toThrow("reconciliation_write_refused:$executeRawUnsafe")
  })

  it("groups a cart's siblings by their base session, keeps the stored charge id, and changes nothing", async () => {
    const before = await base.order.findMany({ where: { id: { in: ids.orders } }, select: { id: true, updatedAt: true }, orderBy: { id: "asc" } })
    const facts = await run.readReconciliationFacts(run.readOnlyPrismaClient(base), { since: new Date(Date.now() - 86_400_000), limit: 1000, readAeToken: false })
    const g = facts.groups.find((x) => x.key === cart)!
    expect(g.orders.map((o) => o.id).sort()).toEqual([ids.orders[0], ids.orders[1]].sort())
    expect(g.orders.every((o) => o.chargedCents === 3600)).toBe(true)
    expect(g.chargeIds).toEqual([`ch_recon_${stamp}`])
    expect(facts.groups.find((x) => x.key === `cs_single_${stamp}`)!.paymentIntentIds).toEqual([`pi_recon_${stamp}`])
    expect(facts.aeTokenRow).toBeNull()
    const after = await base.order.findMany({ where: { id: { in: ids.orders } }, select: { id: true, updatedAt: true }, orderBy: { id: "asc" } })
    expect(after).toEqual(before)
  })
})
