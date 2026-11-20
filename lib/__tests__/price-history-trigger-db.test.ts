/**
 * The supplier price history trigger (migration 20261116200000_product_price_history) on a REAL PostgreSQL.
 * Opt-in like every DB test: RUN_DB_TESTS=1 + a dedicated DATABASE_URL_TEST (lib/testing/db-test-guard.ts). Runs in the
 * CI job `money-db-tests`, whose schema comes from the Prisma datamodel — so the test applies the migration's own SQL
 * (trigger + function) itself, exactly as written in the file.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

/** Splits the migration into statements (Prisma runs one per call); `$$ … $$` bodies are kept whole. */
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

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261116200000_product_price_history/migration.sql")
const stamp = Date.now()

describe.skipIf(!RUN_DB)("ProductPriceHistory trigger — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let supplierId = ""
  let productId = ""

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    // The file is idempotent (IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS): applying it twice must work.
    const parts = statements(readFileSync(MIGRATION, "utf8"))
    expect(parts.length).toBe(10)
    for (let round = 0; round < 2; round++) {
      for (const statement of parts) await prisma.$executeRawUnsafe(statement)
    }
    const supplier = await prisma.user.create({
      data: { email: `price-hist-${stamp}@affisell.test`, role: "SUPPLIER", name: "Price history supplier" },
    })
    supplierId = supplier.id
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.productPriceHistory.deleteMany({ where: { supplierId } })
    await prisma.productVariant.deleteMany({ where: { product: { supplierId } } })
    await prisma.product.deleteMany({ where: { supplierId } })
    await prisma.user.deleteMany({ where: { id: supplierId } })
    await prisma.$disconnect()
  })

  it("records the first price at creation, then every CHANGE of basePriceCents — and nothing else", async () => {
    const product = await prisma.product.create({
      data: { supplierId, name: "Price history product", description: "t", basePriceCents: 1000, commissionRate: 10 },
    })
    productId = product.id

    await prisma.product.update({ where: { id: productId }, data: { basePriceCents: 1200 } })
    await prisma.product.update({ where: { id: productId }, data: { basePriceCents: 1200 } }) // same price: no row
    await prisma.product.update({ where: { id: productId }, data: { name: "Renamed" } }) // other column: no row
    await prisma.product.updateMany({ where: { id: productId }, data: { basePriceCents: 900 } }) // any writer

    const rows = await prisma.productPriceHistory.findMany({ where: { productId, variantKey: null }, orderBy: { id: "asc" } })
    expect(rows.map((r: { priceCents: number; previousCents: number | null; supplierId: string | null }) => [r.priceCents, r.previousCents, r.supplierId])).toEqual([
      [1000, null, supplierId],
      [1200, 1000, supplierId],
      [900, 1200, supplierId],
    ])
  })

  it("follows the advanced SKU lines (variants.variantRows[].priceCents) per row name, only on a real change", async () => {
    const rowsJson = (red: number, blue: number) => ({
      colors: ["Rouge", "Bleu"],
      variantRows: [
        { id: "r1", name: "Rouge / M", priceCents: red, stock: 3 },
        { id: "r2", name: "Bleu / M", priceCents: blue, stock: 3 },
      ],
    })
    await prisma.product.update({ where: { id: productId }, data: { variants: rowsJson(1500, 1600) } })
    await prisma.product.update({ where: { id: productId }, data: { variants: rowsJson(1500, 1600) } }) // same prices
    await prisma.product.update({ where: { id: productId }, data: { variants: rowsJson(1700, 1600) } }) // red only
    await prisma.product.update({ where: { id: productId }, data: { name: "Renamed again" } })

    const rows = await prisma.productPriceHistory.findMany({
      where: { productId, variantKey: { not: null } },
      orderBy: { id: "asc" },
    })
    expect(rows.map((r: { variantKey: string | null; priceCents: number; previousCents: number | null }) => [r.variantKey, r.priceCents, r.previousCents])).toEqual([
      ["row:Rouge / M", 1500, null],
      ["row:Bleu / M", 1600, null],
      ["row:Rouge / M", 1700, 1500],
    ])
  })

  it("follows the ProductVariant table, and a row deleted and recreated at the same price is not a change", async () => {
    const create = (price: number) =>
      prisma.productVariant.create({
        data: { productId, color: "Noir", size: "L", supplierPrice: price / 100, publicPrice: 99, wholesalePriceCents: price },
      })
    const v = await create(2000)
    await prisma.productVariant.update({ where: { id: v.id }, data: { wholesalePriceCents: 2200, supplierPrice: 22 } })
    await prisma.productVariant.delete({ where: { id: v.id } })
    await create(2200) // a sync recreating the same row at the same price

    const rows = await prisma.productPriceHistory.findMany({ where: { productId, variantKey: "pv:Noir/L" }, orderBy: { id: "asc" } })
    expect(rows.map((r: { priceCents: number; previousCents: number | null }) => [r.priceCents, r.previousCents])).toEqual([
      [2000, null],
      [2200, 2000],
    ])
  })

  it("is read back by the loader with a summary", async () => {
    const { loadProductPriceHistory } = await import("@/lib/price-history.server")
    const result = await loadProductPriceHistory(productId)
    expect(result.available).toBe(true)
    if (!result.available) return
    expect(result.points.map((p) => p.priceCents)).toEqual([1000, 1200, 900])
    expect(result.summary).toMatchObject({ currentCents: 900, points: 3 })
    // variant series are separate and never mixed into the base trend
    expect(result.variants.map((v) => [v.label, v.summary.currentCents])).toEqual([
      ["Bleu / M", 1600],
      ["Noir / L", 2200],
      ["Rouge / M", 1700],
    ])
  })
})
