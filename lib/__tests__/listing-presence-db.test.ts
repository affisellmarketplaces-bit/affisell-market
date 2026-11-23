/**
 * The listing presence history (migration 20261124090000_listing_presence_history) on a REAL PostgreSQL, with the real
 * declaration helpers. Opt-in like every DB test (RUN_DB_TESTS=1 + DATABASE_URL_TEST); runs in the CI job
 * « Money-path tests on a real PostgreSQL ». The CI schema comes from the datamodel (no trigger, no CHECK), so the test
 * drops that copy of the table and applies the migration's own SQL twice (idempotent), and also proves the rollback
 * script and a re-application. What must hold in the DATABASE, whatever writes:
 *  - creation, every REAL presence change and deletion are recorded, in write order, nothing else;
 *  - a repeated / concurrent identical change is recorded ONCE; a rolled-back transaction records NOTHING;
 *  - the declared source is kept; the price-history declaration is inherited; a bad value never fails the write;
 *  - the table is append-only (UPDATE / DELETE refused) except a purge under the flag of its own transaction;
 *  - the rebuilt periods of a real sequence are the expected ones.
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

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261124090000_listing_presence_history/migration.sql")
const ROLLBACK = path.join(process.cwd(), "scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql")
const stamp = `lp${Date.now().toString(36)}`

type Ev = { kind: string; previousListed: boolean | null; newListed: boolean | null; source: string; actorId: string | null; effectiveAt: Date }

describe.skipIf(!RUN_DB)("ListingPresenceEvent — real database", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let rec: typeof import("@/lib/listing-presence/record.server")
  let periods: typeof import("@/lib/listing-presence/periods")
  const ids = { supplier: "", affiliate: "", other: "", product: "", listing: "" }

  const events = async (affiliateProductId: string): Promise<Ev[]> =>
    (await prisma.listingPresenceEvent.findMany({ where: { affiliateProductId }, orderBy: { id: "asc" } })) as Ev[]
  const apply = async (file: string) => {
    for (const s of statements(readFileSync(file, "utf8"))) await prisma.$executeRawUnsafe(s)
  }
  const purgeAll = () =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
      await tx.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "productId" = ${ids.product}`
    })

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    rec = await import("@/lib/listing-presence/record.server")
    periods = await import("@/lib/listing-presence/periods")
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    for (let round = 0; round < 2; round++) await apply(MIGRATION)
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") => prisma.user.create({ data: { email: `${stamp}-${tag}@affisell.test`, role, name: tag } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.affiliate = (await mk("a", "AFFILIATE")).id
    ids.other = (await mk("b", "AFFILIATE")).id
    ids.product = (await prisma.product.create({ data: { supplierId: ids.supplier, name: "LP", description: "d", basePriceCents: 2000, commissionRate: 10 } as never })).id
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.affiliateProduct.deleteMany({ where: { productId: ids.product } })
    await purgeAll().catch(() => undefined)
    await prisma.listingPriceHistory.deleteMany({ where: { productId: ids.product } }).catch(() => undefined)
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate, ids.other] } } })
    await prisma.$disconnect()
  })

  it("records creation and every REAL change, in order — a no-op save records nothing", async () => {
    ids.listing = (await prisma.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 3000 } })).id
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: true } }) // same value
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { customTitle: "x" } }) // other column
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: false } })
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: false } }) // double click
    await prisma.affiliateProduct.updateMany({ where: { id: ids.listing }, data: { isListed: true } }) // any writer
    expect((await events(ids.listing)).map((e) => [e.kind, e.previousListed, e.newListed])).toEqual([
      ["created", null, true],
      ["unlisted", true, false],
      ["listed", false, true],
    ])
  })

  it("two concurrent identical withdrawals are recorded once (row lock), a rolled-back one never", async () => {
    await Promise.all([
      prisma.affiliateProduct.updateMany({ where: { id: ids.listing }, data: { isListed: false } }),
      prisma.affiliateProduct.updateMany({ where: { id: ids.listing }, data: { isListed: false } }),
    ])
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: true } })
        throw new Error("rollback")
      }),
    ).rejects.toThrow("rollback")
    const ev = await events(ids.listing)
    expect(ev.filter((e) => e.kind === "unlisted")).toHaveLength(2)
    expect(ev.at(-1)).toMatchObject({ kind: "unlisted" })
    expect(ev.filter((e) => e.kind === "listed")).toHaveLength(1)
  })

  it("keeps the declared source, inherits the price-history one, never fails on a bad value", async () => {
    await rec.withListingPresenceSource(prisma, { source: "reseller_bulk", actorId: ids.affiliate }, (tx) =>
      tx.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: true } }),
    )
    await prisma.$transaction([
      prisma.$queryRaw`SELECT set_config('affisell.listing_price_source', 'reseller_ui', true)::text AS s`,
      prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: false } }),
    ])
    await prisma.$transaction([
      prisma.$queryRaw`SELECT set_config('affisell.listing_presence_source', 'DROP TABLE x;', true)::text AS s, set_config('affisell.listing_presence_actor', 'a b', true)::text AS a`,
      prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: true } }),
    ])
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: false } }) // declaration did not leak
    const last = (await events(ids.listing)).slice(-4).map((e) => [e.kind, e.source, e.actorId])
    expect(last).toEqual([
      ["listed", "reseller_bulk", ids.affiliate],
      ["unlisted", "reseller_ui", null],
      ["listed", "unattributed", null],
      ["unlisted", "unattributed", null],
    ])
  })

  it("records a deletion and rebuilds the real periods", async () => {
    const other = await prisma.affiliateProduct.create({ data: { affiliateId: ids.other, productId: ids.product, sellingPriceCents: 3100, isListed: false } })
    await prisma.affiliateProduct.update({ where: { id: other.id }, data: { isListed: true } })
    await prisma.affiliateProduct.delete({ where: { id: other.id } })
    const ev = await events(other.id)
    expect(ev.map((e) => e.kind)).toEqual(["created", "listed", "deleted"])
    const h = periods.rebuildPresence({ current: null, events: ev as never, trackingStartedAt: new Date(0) })
    expect(h.status).toBe("historique_exact")
    expect(h.periods).toHaveLength(1)
    expect(h.relistings).toBe(0)
    expect(h.deleted).toBe(true)
    // Each reseller's history is its own.
    expect((await events(ids.listing)).every((e) => e.kind !== "deleted")).toBe(true)
  })

  it("is append-only: UPDATE and DELETE are refused, a purge needs its own flag", async () => {
    await expect(prisma.$executeRaw`UPDATE "ListingPresenceEvent" SET "source" = 'x' WHERE "productId" = ${ids.product}`).rejects.toThrow(/append-only/)
    await expect(prisma.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "productId" = ${ids.product}`).rejects.toThrow(/append-only/)
    const n = await prisma.$transaction((tx) => rec.purgeAffiliatePresenceInTransaction(tx, ids.other))
    expect(n).toBe(3)
    expect(await prisma.listingPresenceEvent.count({ where: { affiliateId: ids.other } })).toBe(0)
    expect(await prisma.listingPresenceEvent.count({ where: { affiliateId: ids.affiliate } })).toBeGreaterThan(0)
  })

  it("the rollback script removes table and triggers; the migration re-applies cleanly", async () => {
    await apply(ROLLBACK)
    const t = (await prisma.$queryRaw`SELECT to_regclass('"ListingPresenceEvent"')::text AS t`) as Array<{ t: string | null }>
    expect(t[0]?.t).toBeNull()
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: true } }) // still writable without history
    await apply(MIGRATION)
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: false } })
    expect((await events(ids.listing)).map((e) => e.kind)).toEqual(["unlisted"])
  })
})
