/**
 * Continuous customer-invoice numbering against a REAL database (test database only — see lib/testing/db-test-guard.ts).
 *   npm run test:db
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = Date.now()

describe.skipIf(!RUN_DB)("customer invoice numbering — real DB", { timeout: 180_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let ensure: (typeof import("@/lib/invoices/invoice-number.server"))["ensureCustomerInvoiceNumber"]
  const ids = { supplier: "", affA: "", affB: "", listingA: "", listingB: "", product: "" }
  const orderIds: string[] = []

  const makeOrder = async (tag: string, affiliateId: string, listingId: string) => {
    const o = await prisma.order.create({
      data: {
        productId: ids.product, affiliateProductId: listingId, supplierId: ids.supplier, affiliateId,
        customerEmail: `buyer-${tag}@affisell.test`, shippingAddress: { country: "FR" }, stripeSessionId: `cs_inv_${stamp}_${tag}`,
        basePriceCents: 1000, sellingPriceCents: 1500, commissionCents: 100, marginCents: 500, affiliatePayoutCents: 100,
        quantity: 1, status: "paid", paidAt: new Date(),
      } as never,
    })
    orderIds.push(o.id)
    return o.id
  }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ ensureCustomerInvoiceNumber: ensure } = await import("@/lib/invoices/invoice-number.server"))
    const supplier = await prisma.user.create({ data: { email: `inv-e2e-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "Inv Supplier" } })
    const affA = await prisma.user.create({ data: { email: `inv-e2e-affa-${stamp}@affisell.test`, role: "AFFILIATE", name: "Inv Reseller A" } })
    const affB = await prisma.user.create({ data: { email: `inv-e2e-affb-${stamp}@affisell.test`, role: "AFFILIATE", name: "Inv Reseller B" } })
    const product = await prisma.product.create({ data: { supplierId: supplier.id, name: "Inv product", description: "x", basePriceCents: 1000, commissionRate: 10 } })
    const listingA = await prisma.affiliateProduct.create({ data: { affiliateId: affA.id, productId: product.id, sellingPriceCents: 1500 } })
    const listingB = await prisma.affiliateProduct.create({ data: { affiliateId: affB.id, productId: product.id, sellingPriceCents: 1500 } })
    Object.assign(ids, { supplier: supplier.id, affA: affA.id, affB: affB.id, listingA: listingA.id, listingB: listingB.id, product: product.id })
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    const userIds = [ids.supplier, ids.affA, ids.affB].filter(Boolean)
    await prisma.invoiceSequence.deleteMany({ where: { issuerKey: { in: [ids.affA, ids.affB] } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    await prisma.affiliateProduct.deleteMany({ where: { affiliateId: { in: userIds } } })
    await prisma.product.deleteMany({ where: { supplierId: { in: userIds } } })
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.$disconnect()
  }, 60_000)

  it("numbers one issuer's invoices 1, 2, 3 without gaps, and never renumbers an order", async () => {
    const [o1, o2, o3] = [await makeOrder("a1", ids.affA, ids.listingA), await makeOrder("a2", ids.affA, ids.listingA), await makeOrder("a3", ids.affA, ids.listingA)]
    const n1 = (await ensure(o1)).number
    const n2 = (await ensure(o2)).number
    const n3 = (await ensure(o3)).number
    const seq = [n1, n2, n3].map((n) => Number(n.split("-").pop()))
    expect(seq).toEqual([1, 2, 3])
    expect((await ensure(o1)).number).toBe(n1) // idempotent
    expect((await ensure(o2)).number).toBe(n2)
    expect(new Set([n1, n2, n3]).size).toBe(3)
  })

  it("gives concurrent downloads of the same order ONE number and burns none", async () => {
    const o = await makeOrder("c1", ids.affA, ids.listingA)
    const results = await Promise.all(Array.from({ length: 6 }, () => ensure(o)))
    expect(new Set(results.map((r) => r.number)).size).toBe(1)
    const next = await makeOrder("c2", ids.affA, ids.listingA)
    // sequence continued from the 4th number: no gap left by the 5 losing requests
    expect(Number((await ensure(next)).number.split("-").pop())).toBe(Number(results[0]!.number.split("-").pop()) + 1)
  })

  it("keeps a separate counter per issuer", async () => {
    const o = await makeOrder("b1", ids.affB, ids.listingB)
    const stamp1 = await ensure(o)
    expect(Number(stamp1.number.split("-").pop())).toBe(1)
    expect(stamp1.number).not.toContain("-AFF-")
  })
})
