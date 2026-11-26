/**
 * The three production reports, run on a REAL non-production PostgreSQL (the CI's throwaway database):
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/read-only-reports-db.test.ts
 * Each collector runs exactly as the script runs it — inside `SET TRANSACTION READ ONLY`, on the client that refuses
 * writes — and must (1) count what was seeded (measured as a DIFFERENCE before / after seeding: the database is shared
 * with other tests), (2) change nothing it read.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`

describe.skipIf(!RUN_DB)("read-only reports — real database", { timeout: 120_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let base: any
  let run: typeof import("@/lib/strategic-intelligence/fee-reconciliation-run")
  let stock: typeof import("@/lib/reports/checkout-stock-report")
  let readiness: typeof import("@/lib/reports/listing-readiness-report")
  let legacy: typeof import("@/lib/reports/legacy-reseller-imports-report")
  const ids = { supplier: "", affiliate: "", products: [] as string[], listing: "" }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const before: Record<string, any> = {}

  const read = <T,>(work: (tx: never) => Promise<T>) =>
    run.withReadOnlyTransaction(run.readOnlyPrismaClient(base), work as never) as Promise<T>

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client")
    run = await import("@/lib/strategic-intelligence/fee-reconciliation-run")
    stock = await import("@/lib/reports/checkout-stock-report")
    readiness = await import("@/lib/reports/listing-readiness-report")
    legacy = await import("@/lib/reports/legacy-reseller-imports-report")
    base = new PrismaClient({ log: [] })

    before.stock = await read((tx) => stock.collectCheckoutStockReport(tx))
    before.readiness = await read((tx) => readiness.collectListingReadinessReport(tx))
    before.legacy = await read((tx) => legacy.collectLegacyResellerImports(tx))

    ids.supplier = (await base.user.create({ data: { email: `rep-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "S" } })).id
    ids.affiliate = (await base.user.create({ data: { email: `rep-aff-${stamp}@affisell.test`, role: "AFFILIATE", name: "A" } })).id
    const product = async (over: Record<string, unknown>) =>
      (
        await base.product.create({
          data: { supplierId: ids.supplier, name: "Rep", description: "d", basePriceCents: 2000, commissionRate: 10, isDraft: false, active: true, listingKind: "PHYSICAL", ...over },
        })
      ).id
    ids.products.push(await product({ stock: 0 }))
    ids.products.push(await product({ stock: 99 }))
    ids.products.push(await product({ stock: 5, hasVariants: true, variants: { colors: ["red"] } }))
    // A legacy reseller import (no review tag), live, no photo, placeholder stock, listed by one reseller.
    const legacyId = await product({ stock: 999, importSource: "reseller_url_import", sourceUrl: "https://www.aliexpress.com/item/1.html", images: [] })
    ids.products.push(legacyId)
    ids.listing = (await base.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: legacyId, sellingPriceCents: 3000, isListed: true } })).id
    // A reviewed import: must NOT be counted as legacy.
    ids.products.push(await product({ stock: 3, importSource: "reseller_url_import", tags: ["import-review:approved"] }))
  })

  afterAll(async () => {
    if (!base) return
    await base.affiliateProduct.deleteMany({ where: { id: ids.listing } })
    await base.product.deleteMany({ where: { id: { in: ids.products } } })
    await base.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate] } } })
    await base.$disconnect()
  })

  it("report:checkout-stock counts the seeded stocks", async () => {
    const after = await read((tx) => stock.collectCheckoutStockReport(tx))
    expect(after.livePhysicalProducts - before.stock.livePhysicalProducts).toBe(5)
    expect(after.stockZeroOrLess - before.stock.stockZeroOrLess).toBe(1)
    expect((after.placeholderStockCounts["99"] ?? 0) - (before.stock.placeholderStockCounts["99"] ?? 0)).toBe(1)
    expect((after.placeholderStockCounts["999"] ?? 0) - (before.stock.placeholderStockCounts["999"] ?? 0)).toBe(1)
    expect(after.tableOnlyVariantProducts - before.stock.tableOnlyVariantProducts).toBe(1)
  })

  it("report:listing-readiness sees the seeded products as not ready (no manufacturer data)", async () => {
    const after = await read((tx) => readiness.collectListingReadinessReport(tx))
    expect(after.livePhysicalProducts - before.readiness.livePhysicalProducts).toBe(5)
    expect(after.wouldBeRefusedIfPublishedToday - before.readiness.wouldBeRefusedIfPublishedToday).toBe(5)
  })

  it("report:legacy-reseller-imports counts the untagged import only, with its risks", async () => {
    const after = await read((tx) => legacy.collectLegacyResellerImports(tx))
    const a = after.inventory
    const b = before.legacy.inventory
    expect(a.products - b.products).toBe(1)
    expect(a.live - b.live).toBe(1)
    expect(a.listedListings - b.listedListings).toBe(1)
    expect(a.risks.liveWithoutImage - b.risks.liveWithoutImage).toBe(1)
    expect(a.risks.liveWithPlaceholderStock - b.risks.liveWithPlaceholderStock).toBe(1)
  })

  it("nothing the reports read has changed", async () => {
    const rows = await base.product.findMany({ where: { id: { in: ids.products } }, select: { id: true, updatedAt: true, stock: true, active: true, isDraft: true } })
    await read((tx) => stock.collectCheckoutStockReport(tx))
    await read((tx) => readiness.collectListingReadinessReport(tx))
    await read((tx) => legacy.collectLegacyResellerImports(tx))
    const again = await base.product.findMany({ where: { id: { in: ids.products } }, select: { id: true, updatedAt: true, stock: true, active: true, isDraft: true } })
    expect(again).toEqual(rows)
  })
})
