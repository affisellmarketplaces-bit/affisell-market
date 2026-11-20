/**
 * The reseller selling-price history trigger (migration 20261117090000_listing_price_history) on a REAL PostgreSQL,
 * together with the real source-declaration helper. Opt-in like every DB test: RUN_DB_TESTS=1 + a dedicated
 * DATABASE_URL_TEST (lib/testing/db-test-guard.ts). Runs in the CI job `money-db-tests`. The job's schema comes from the
 * Prisma datamodel (no CHECK constraints, no trigger), so the test drops that copy of the table and applies the
 * migration's own SQL, exactly as written — twice, to prove it is idempotent.
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

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261117090000_listing_price_history/migration.sql")
const stamp = Date.now()

type Row = { variantKey: string | null; priceCents: number | null; previousCents: number | null; source: string; actorId: string | null; affiliateId: string; currency: string }

describe.skipIf(!RUN_DB)("ListingPriceHistory trigger — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let record: typeof import("@/lib/listing-price-history/record.server")
  const ids = { supplier: "", affiliate: "", other: "", product: "", listing: "", otherListing: "" }

  const history = async (affiliateProductId: string): Promise<Row[]> =>
    (await prisma.listingPriceHistory.findMany({ where: { affiliateProductId }, orderBy: { id: "asc" } })) as Row[]

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    record = await import("@/lib/listing-price-history/record.server")
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPriceHistory" CASCADE')
    const parts = statements(readFileSync(MIGRATION, "utf8"))
    expect(parts.length).toBe(6)
    for (let round = 0; round < 2; round++) {
      for (const statement of parts) await prisma.$executeRawUnsafe(statement)
    }
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") =>
      prisma.user.create({ data: { email: `lph-${tag}-${stamp}@affisell.test`, role, name: `LPH ${tag}` } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.affiliate = (await mk("a", "AFFILIATE")).id
    ids.other = (await mk("b", "AFFILIATE")).id
    ids.product = (
      await prisma.product.create({
        data: { supplierId: ids.supplier, name: "LPH product", description: "t", basePriceCents: 2000, commissionRate: 10 },
      })
    ).id
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.listingPriceHistory.deleteMany({ where: { productId: ids.product } })
    await prisma.affiliateProduct.deleteMany({ where: { productId: ids.product } })
    await prisma.productPriceHistory.deleteMany({ where: { productId: ids.product } }).catch(() => undefined)
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate, ids.other] } } })
    await prisma.$disconnect()
  })

  it("records the first price, then every real change — with its source and actor — and nothing else", async () => {
    ids.listing = (
      await prisma.affiliateProduct.create({
        data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 3000 },
      })
    ).id
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { sellingPriceCents: 3000 } }) // same: no row
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { customTitle: "x" } }) // other column: no row
    await record.updateListingWithPriceSource(
      { where: { id: ids.listing }, data: { sellingPriceCents: 2700 } },
      { source: "reseller_ui", actorId: ids.affiliate }
    )
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { sellingPriceCents: 2800 } }) // the declaration did not leak
    await prisma.affiliateProduct.updateMany({ where: { id: ids.listing }, data: { sellingPriceCents: 2900 } }) // any writer

    expect((await history(ids.listing)).map((r) => [r.variantKey, r.priceCents, r.previousCents, r.source, r.actorId, r.currency])).toEqual([
      [null, 3000, null, "unattributed", null, "EUR"],
      [null, 2700, 3000, "reseller_ui", ids.affiliate, "EUR"],
      [null, 2800, 2700, "unattributed", null, "EUR"],
      [null, 2900, 2800, "unattributed", null, "EUR"],
    ])
  })

  it("follows each variant price, records a removed override, and ignores a re-save of the same prices", async () => {
    const pricing = (red: number, blue?: number) => ({
      red: { sellingPriceCents: red, marginCents: 100 },
      ...(blue ? { blue: { sellingPriceCents: blue, marginCents: 100 } } : {}),
    })
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { variantPricing: pricing(3100, 3200) } })
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { variantPricing: pricing(3100, 3200) } })
    await record.updateListingWithPriceSource(
      { where: { id: ids.listing }, data: { variantPricing: pricing(3150) } },
      { source: "auto_adjust" }
    )
    const rows = (await history(ids.listing)).filter((r) => r.variantKey !== null)
    expect(rows.map((r) => [r.variantKey, r.priceCents, r.previousCents, r.source])).toEqual(
      expect.arrayContaining([
        ["opt:red", 3100, null, "unattributed"],
        ["opt:blue", 3200, null, "unattributed"],
        ["opt:red", 3150, 3100, "auto_adjust"],
        ["opt:blue", null, 3200, "auto_adjust"],
      ])
    )
    expect(rows).toHaveLength(4)
  })

  it("never lets a bad declaration fail the write or reach the table", async () => {
    await prisma.$transaction([
      prisma.$queryRaw`SELECT set_config('affisell.listing_price_source', 'DROP TABLE x;', true)::text AS s, set_config('affisell.listing_price_actor', 'a b', true)::text AS a`,
      prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { sellingPriceCents: 3300 } }),
    ])
    const last = (await history(ids.listing)).at(-1)!
    expect(last).toMatchObject({ priceCents: 3300, source: "unattributed", actorId: null })
  })

  it("keeps each reseller's history apart", async () => {
    ids.otherListing = (
      await record.upsertListingWithPriceSource(
        {
          where: { affiliateId_productId: { affiliateId: ids.other, productId: ids.product } },
          create: { affiliateId: ids.other, productId: ids.product, sellingPriceCents: 4000 },
          update: { sellingPriceCents: 4000 },
        },
        { source: "listing_create", actorId: ids.other }
      )
    ).id
    const mine = await prisma.listingPriceHistory.findMany({ where: { affiliateId: ids.affiliate } })
    const theirs = (await prisma.listingPriceHistory.findMany({ where: { affiliateId: ids.other } })) as Row[]
    expect(mine.every((r: { affiliateProductId: string }) => r.affiliateProductId === ids.listing)).toBe(true)
    expect(theirs.map((r) => [r.priceCents, r.source, r.actorId])).toEqual([[4000, "listing_create", ids.other]])
  })

  it("the table refuses rows that are not a change or carry an invalid source", async () => {
    const insert = (price: number | null, previous: number | null, source: string, key: string | null = null) =>
      prisma.$executeRaw`INSERT INTO "ListingPriceHistory" ("affiliateProductId","affiliateId","productId","variantKey","priceCents","previousCents","source") VALUES (${ids.listing}, ${ids.affiliate}, ${ids.product}, ${key}, ${price}, ${previous}, ${source})`
    await expect(insert(100, 100, "script")).rejects.toThrow()
    await expect(insert(100, 90, "Bad Source")).rejects.toThrow()
    await expect(insert(-1, 90, "script")).rejects.toThrow()
    await expect(insert(null, 90, "script")).rejects.toThrow() // a listing price is never "removed"
  })
})
