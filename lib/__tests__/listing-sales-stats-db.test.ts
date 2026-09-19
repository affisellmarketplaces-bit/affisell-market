/**
 * Confirmed-sales aggregation against a REAL database (test database only — see lib/testing/db-test-guard.ts).
 *   npm run test:db
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = Date.now()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

describe.skipIf(!RUN_DB)("listing sales stats — real DB", { timeout: 180_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let loadListingSalesStats: (typeof import("@/lib/listing-sales-stats"))["loadListingSalesStats"]
  const ids = { supplier: "", affiliate: "", product: "", listing: "", empty: "" }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ loadListingSalesStats } = await import("@/lib/listing-sales-stats"))
    const supplier = await prisma.user.create({ data: { email: `money-e2e-sales-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "Sales Supplier" } })
    const affiliate = await prisma.user.create({ data: { email: `money-e2e-sales-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "Sales Reseller" } })
    const product = await prisma.product.create({ data: { supplierId: supplier.id, name: "Sales product", description: "x", basePriceCents: 1000, commissionRate: 10 } })
    const listing = await prisma.affiliateProduct.create({ data: { affiliateId: affiliate.id, productId: product.id, sellingPriceCents: 1500, conversions: 999 } })
    const product2 = await prisma.product.create({ data: { supplierId: supplier.id, name: "Sales product 2", description: "x", basePriceCents: 1000, commissionRate: 10 } })
    const empty = await prisma.affiliateProduct.create({ data: { affiliateId: affiliate.id, productId: product2.id, sellingPriceCents: 1500 } })
    Object.assign(ids, { supplier: supplier.id, affiliate: affiliate.id, product: product.id, listing: listing.id, empty: empty.id })

    const order = (tag: string, quantity: number, status: string, paidAt: Date | null) =>
      prisma.order.create({
        data: {
          productId: product.id, affiliateProductId: listing.id, supplierId: supplier.id, affiliateId: affiliate.id,
          customerEmail: `buyer-${tag}@affisell.test`, shippingAddress: { country: "FR" }, stripeSessionId: `cs_sales_${stamp}_${tag}`,
          basePriceCents: 1000, sellingPriceCents: 1500, commissionCents: 100, marginCents: 500, affiliatePayoutCents: 100,
          quantity, status, paidAt,
        } as never,
      })

    await order("a", 2, "paid", minutesAgo(3 * 24 * 60)) // 3 days ago
    await order("b", 3, "shipped", minutesAgo(10)) // 10 min ago
    await order("c", 4, "delivered", minutesAgo(10 * 24 * 60)) // 10 days ago
    await order("d", 5, "CANCELLED", minutesAgo(30)) // cancelled after payment
    await order("e", 1, "refunded", minutesAgo(45)) // refunded
    await order("f", 7, "PENDING", null) // never paid
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    const users = await prisma.user.findMany({ where: { email: { startsWith: "money-e2e-sales-", endsWith: "@affisell.test" } }, select: { id: true } })
    const userIds = users.map((u) => u.id)
    if (userIds.length > 0) {
      await prisma.order.deleteMany({ where: { OR: [{ supplierId: { in: userIds } }, { affiliateId: { in: userIds } }] } })
      await prisma.affiliateProduct.deleteMany({ where: { affiliateId: { in: userIds } } })
      await prisma.product.deleteMany({ where: { supplierId: { in: userIds } } })
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    await prisma.$disconnect()
  }, 60_000)

  it("counts only paid, non-cancelled, non-refunded units — ignoring the stale conversions counter", async () => {
    const stats = (await loadListingSalesStats([ids.listing, ids.empty])).get(ids.listing)!
    expect(stats.units).toBe(2 + 3 + 4) // not 999 (counter), not +5 cancelled / +1 refunded / +7 pending
    expect(stats.units7d).toBe(2 + 3)
    expect(stats.units24h).toBe(3)
    const ago = Date.now() - new Date(stats.lastPaidAt!).getTime()
    expect(ago).toBeGreaterThanOrEqual(9 * 60_000)
    expect(ago).toBeLessThan(15 * 60_000)
  })

  it("returns nothing for a listing without confirmed sales, and handles an empty request", async () => {
    expect((await loadListingSalesStats([ids.empty])).has(ids.empty)).toBe(false)
    expect((await loadListingSalesStats([])).size).toBe(0)
  })
})
