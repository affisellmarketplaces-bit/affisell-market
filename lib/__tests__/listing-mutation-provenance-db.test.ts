/**
 * Listing mutation provenance on a REAL PostgreSQL (CI job « Money-path tests on a real PostgreSQL »; opt-in locally
 * like every DB test). The migration's own SQL is applied to a fresh copy of the table. What must hold in the DATABASE:
 *  - each life change carries the source its path declared (creation, unlisting, relisting, deletion);
 *  - a declaration made through a transaction client lands in THAT transaction (the fixed defect);
 *  - two concurrent transactions keep their own declarations (set_config is transaction-local);
 *  - a declaration never leaks to the next write on a reused connection, nor survives a rollback;
 *  - an undeclared write stays « unattributed » (never guessed); a no-op write records nothing;
 *  - deleting a supplier account records the other resellers' listing deletions as `account_deletion`.
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
const stamp = `mp${Date.now().toString(36)}`

describe.skipIf(!RUN_DB)("listing mutation provenance — real database", { timeout: 180_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let declare: typeof import("@/lib/listing-presence/declare")
  const ids = { supplier: "", supplier2: "", a1: "", a2: "", product: "", product2: "", l1: "", l2: "", l3: "" }
  const sourcesOf = async (listing: string) =>
    (await prisma.listingPresenceEvent.findMany({ where: { affiliateProductId: listing }, orderBy: { id: "asc" }, select: { kind: true, source: true } })).map((e) => `${e.kind}:${e.source}`)

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    declare = await import("@/lib/listing-presence/declare")
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    for (const s of statements(readFileSync(MIGRATION, "utf8"))) await prisma.$executeRawUnsafe(s)
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") => prisma.user.create({ data: { email: `${stamp}-${tag}@affisell.test`, role, name: tag } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.supplier2 = (await mk("s2", "SUPPLIER")).id
    ids.a1 = (await mk("a1", "AFFILIATE")).id
    ids.a2 = (await mk("a2", "AFFILIATE")).id
    const product = (supplierId: string) => prisma.product.create({ data: { supplierId, name: "MP", description: "d", basePriceCents: 2000, commissionRate: 10 } as never })
    ids.product = (await product(ids.supplier)).id
    ids.product2 = (await product(ids.supplier2)).id
  }, 90_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.affiliateProduct.deleteMany({ where: { productId: { in: [ids.product, ids.product2] } } }).catch(() => undefined)
    await prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
        await tx.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "productId" IN (${ids.product}, ${ids.product2})`
      })
      .catch(() => undefined)
    await prisma.listingPriceHistory.deleteMany({ where: { productId: { in: [ids.product, ids.product2] } } }).catch(() => undefined)
    await prisma.product.deleteMany({ where: { id: { in: [ids.product, ids.product2] } } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.supplier2, ids.a1, ids.a2].filter(Boolean) } } }).catch(() => undefined) // supplier2 already deleted by the test
    await prisma.$disconnect()
  })

  it("creation, unlisting, relisting each carry their declared source; a no-op records nothing", async () => {
    ids.l1 = (await declare.withListingPresenceSource(prisma, { source: "listing_create", actorId: ids.a1 }, (tx) => tx.affiliateProduct.create({ data: { affiliateId: ids.a1, productId: ids.product, sellingPriceCents: 3000 } }))).id
    await declare.withListingPresenceSource(prisma, { source: "reseller_bulk" }, (tx) => tx.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: false } }))
    await declare.withListingPresenceSource(prisma, { source: "reseller_bulk" }, (tx) => tx.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: false } })) // no-op
    await declare.withListingPresenceSource(prisma, { source: "reseller_ui" }, (tx) => tx.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: true } }))
    expect(await sourcesOf(ids.l1)).toEqual(["created:listing_create", "unlisted:reseller_bulk", "listed:reseller_ui"])
    const actor = await prisma.listingPresenceEvent.findFirst({ where: { affiliateProductId: ids.l1, kind: "created" }, select: { actorId: true } })
    expect(actor?.actorId).toBe(ids.a1)
  })

  it("the fixed defect: a declaration made through an open transaction client lands in that transaction", async () => {
    await prisma.$transaction(async (tx) => {
      await declare.withListingPresenceSource(tx, { source: "exclusivity" }, (t) => t.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: false } }))
    })
    expect((await sourcesOf(ids.l1)).at(-1)).toBe("unlisted:exclusivity")
  })

  it("an undeclared write stays « unattributed »; a declaration never leaks to the next write nor survives a rollback", async () => {
    await prisma.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: true } }) // undeclared, right after declared writes
    expect((await sourcesOf(ids.l1)).at(-1)).toBe("listed:unattributed")
    await expect(
      prisma.$transaction(async (tx) => {
        await declare.declareListingPresenceSource(tx, { source: "admin_review" })
        await tx.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: false } })
        throw new Error("rollback")
      }),
    ).rejects.toThrow("rollback")
    expect((await sourcesOf(ids.l1)).at(-1)).toBe("listed:unattributed") // nothing recorded by the rolled-back transaction
    await prisma.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: false } })
    expect((await sourcesOf(ids.l1)).at(-1)).toBe("unlisted:unattributed") // the rolled-back declaration did not leak
  })

  it("concurrent transactions keep their own sources; concurrent identical changes record once", async () => {
    ids.l2 = (await declare.withListingPresenceSource(prisma, { source: "listing_create" }, (tx) => tx.affiliateProduct.create({ data: { affiliateId: ids.a2, productId: ids.product, sellingPriceCents: 3100 } }))).id
    await Promise.all([
      declare.withListingPresenceSource(prisma, { source: "reseller_bulk" }, (tx) => tx.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: true } })),
      declare.withListingPresenceSource(prisma, { source: "replacement" }, (tx) => tx.affiliateProduct.update({ where: { id: ids.l2 }, data: { isListed: false } })),
    ])
    expect((await sourcesOf(ids.l1)).at(-1)).toBe("listed:reseller_bulk")
    expect((await sourcesOf(ids.l2)).at(-1)).toBe("unlisted:replacement")
    const before = (await sourcesOf(ids.l2)).length
    await Promise.all([
      declare.withListingPresenceSource(prisma, { source: "reseller_ui" }, (tx) => tx.affiliateProduct.updateMany({ where: { id: ids.l2 }, data: { isListed: true } })),
      declare.withListingPresenceSource(prisma, { source: "reseller_ui" }, (tx) => tx.affiliateProduct.updateMany({ where: { id: ids.l2 }, data: { isListed: true } })),
    ])
    expect((await sourcesOf(ids.l2)).length).toBe(before + 1)
  })

  it("a supplier account deletion records the other resellers' listing deletions as account_deletion", async () => {
    const { deleteMerchantUser } = await import("@/lib/delete-merchant-account")
    ids.l3 = (await declare.withListingPresenceSource(prisma, { source: "listing_create" }, (tx) => tx.affiliateProduct.create({ data: { affiliateId: ids.a1, productId: ids.product2, sellingPriceCents: 3000 } }))).id
    const r = await deleteMerchantUser(ids.supplier2, "SUPPLIER")
    expect(r).toEqual({ ok: true })
    expect(await sourcesOf(ids.l3)).toEqual(["created:listing_create", "deleted:account_deletion"])
  })
})
