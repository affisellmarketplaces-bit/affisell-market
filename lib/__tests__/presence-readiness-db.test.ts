/**
 * `report:presence-readiness` on a REAL PostgreSQL (CI job « Money-path tests on a real PostgreSQL »; opt-in locally
 * like every DB test). The collector runs exactly as the script runs it: through the read-only client, inside a
 * `SET TRANSACTION READ ONLY` transaction. What must hold:
 *  - the TRUNCATE guard refuses TRUNCATE, and only a transaction that declared the maintenance flag can truncate;
 *  - the append-only protection still refuses UPDATE;
 *  - the report sees a conform installation as conform, and turns BLOCKED when a trigger is absent, incorrect or
 *    disabled — the capture can not report its own silence, the catalog can;
 *  - a write made in replica mode leaves no event, and the report's reconciliation reveals it afterwards;
 *  - idempotence / concurrency: repeated and concurrent identical changes leave no duplicate and no gap;
 *  - injected anomalies (orphan, chain break, duplicate, future date, wrong reseller) are counted, no identifier shown;
 *  - the report itself writes nothing.
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
const stamp = `pr${Date.now().toString(36)}`

describe.skipIf(!RUN_DB)("report:presence-readiness — real database", { timeout: 180_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let base: any
  let run: typeof import("@/lib/strategic-intelligence/fee-reconciliation-run")
  let collector: typeof import("@/lib/reports/presence-readiness-report")
  const ids = { supplier: "", a1: "", a2: "", product: "", l1: "", l2: "" }
  let trackingStart = new Date()
  const staticFacts = { migrationFilePresent: true, migrationSql: readFileSync(MIGRATION, "utf8"), rollbackSql: readFileSync(ROLLBACK, "utf8") }

  const apply = async (file: string) => {
    for (const s of statements(readFileSync(file, "utf8"))) await base.$executeRawUnsafe(s)
  }
  const report = () =>
    run.withReadOnlyTransaction(run.readOnlyPrismaClient(base), (tx) =>
      collector.collectPresenceReadiness(tx, { staticFacts, trackingStartOverride: trackingStart }),
    )
  const check = (r: Awaited<ReturnType<typeof report>>, id: string) => r.checks.find((c) => c.id === id)!
  const purge = () =>
    base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
      await tx.$executeRaw`DELETE FROM "ListingPresenceEvent"`
    })

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client")
    base = new PrismaClient({ log: [] })
    run = await import("@/lib/strategic-intelligence/fee-reconciliation-run")
    collector = await import("@/lib/reports/presence-readiness-report")
    await base.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    await apply(MIGRATION)
    await apply(MIGRATION) // idempotent
    trackingStart = new Date(Date.now() - 1000)
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") => base.user.create({ data: { email: `${stamp}-${tag}@affisell.test`, role, name: tag } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.a1 = (await mk("a1", "AFFILIATE")).id
    ids.a2 = (await mk("a2", "AFFILIATE")).id
    ids.product = (await base.product.create({ data: { supplierId: ids.supplier, name: "PR", description: "d", basePriceCents: 2000, commissionRate: 10 } })).id
    ids.l1 = (await base.affiliateProduct.create({ data: { affiliateId: ids.a1, productId: ids.product, sellingPriceCents: 3000 } })).id
    ids.l2 = (await base.affiliateProduct.create({ data: { affiliateId: ids.a2, productId: ids.product, sellingPriceCents: 3100 } })).id
  }, 90_000)

  afterAll(async () => {
    if (!base) return
    await apply(MIGRATION).catch(() => undefined) // leave the protections as the migration defines them
    await base.affiliateProduct.deleteMany({ where: { productId: ids.product } }).catch(() => undefined)
    await purge().catch(() => undefined)
    await base.listingPriceHistory?.deleteMany({ where: { productId: ids.product } }).catch(() => undefined)
    await base.product.deleteMany({ where: { id: ids.product } }).catch(() => undefined)
    await base.user.deleteMany({ where: { id: { in: [ids.supplier, ids.a1, ids.a2].filter(Boolean) } } }).catch(() => undefined)
    await base.$disconnect()
  })

  it("TRUNCATE is refused; only a transaction that declared the maintenance flag could truncate (rolled back here)", async () => {
    const before = await base.listingPresenceEvent.count()
    expect(before).toBeGreaterThan(0)
    await expect(base.$executeRawUnsafe('TRUNCATE "ListingPresenceEvent"')).rejects.toThrow(/can not be truncated/)
    await expect(
      base.$transaction(async (tx: typeof base) => {
        await tx.$queryRaw`SELECT set_config('affisell.listing_presence_truncate', 'on', true)::text AS f`
        await tx.$executeRawUnsafe('TRUNCATE "ListingPresenceEvent"')
        expect(await tx.listingPresenceEvent.count()).toBe(0)
        throw new Error("rollback")
      }),
    ).rejects.toThrow("rollback")
    expect(await base.listingPresenceEvent.count()).toBe(before)
    // The flag lives only in that transaction: the next TRUNCATE is refused again.
    await expect(base.$executeRawUnsafe('TRUNCATE "ListingPresenceEvent"')).rejects.toThrow(/can not be truncated/)
    await expect(base.$executeRawUnsafe('UPDATE "ListingPresenceEvent" SET "source" = \'x\'')).rejects.toThrow(/append-only/)
  })

  it("the instant is recorded in UTC whatever the session TimeZone (Prisma reads the column as UTC)", async () => {
    await base.$transaction(async (tx: typeof base) => {
      await tx.$executeRawUnsafe("SET LOCAL TimeZone = 'Asia/Tokyo'")
      await tx.affiliateProduct.update({ where: { id: ids.l2 }, data: { isListed: false } })
    })
    const last = await base.listingPresenceEvent.findFirst({ where: { affiliateProductId: ids.l2 }, orderBy: { id: "desc" } })
    expect(Math.abs(last.effectiveAt.getTime() - Date.now())).toBeLessThan(60_000)
    await base.affiliateProduct.update({ where: { id: ids.l2 }, data: { isListed: true } })
  })

  it("idempotent and concurrent identical changes: a conform installation reads as conform, no duplicate, no gap", async () => {
    await base.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: true } }) // no-op
    await Promise.all([
      base.affiliateProduct.updateMany({ where: { id: ids.l1 }, data: { isListed: false } }),
      base.affiliateProduct.updateMany({ where: { id: ids.l1 }, data: { isListed: false } }),
    ])
    await base.affiliateProduct.update({ where: { id: ids.l1 }, data: { isListed: true } }) // relisting
    const eventsBefore = await base.listingPresenceEvent.count()
    const auditBefore = await base.auditLog.count()
    const r = await report()
    // the report wrote nothing
    expect(await base.listingPresenceEvent.count()).toBe(eventsBefore)
    expect(await base.auditLog.count()).toBe(auditBefore)
    for (const id of ["A5_table", "A6_constraints_indexes", "B_AffiliateProduct_listing_presence_history", "B_ListingPresenceEvent_append_only", "B_ListingPresenceEvent_no_truncate"]) {
      expect(check(r, id).status, id).toBe("PASS")
    }
    expect(check(r, "B_idempotence").status).toBe("PASS")
    expect(check(r, "C_sequences").status).toBe("PASS")
    expect(check(r, "C_orphans_isolation").status).toBe("PASS")
    expect(check(r, "B_capture_observed").evidence.join(" ")).toContain("écarts entre l'état des annonces et le dernier événement : 0")
    expect(r.volumes?.listingsWithHistory).toBe(2)
    expect(r.engines?.length).toBe(5)
    // The exported facts the collection monitor compares: counts, newest event (UTC), concentration — on the real database.
    expect(r.facts?.integrity?.events).toBe(eventsBefore)
    const newest = Date.parse(r.facts?.integrity?.newestEventAt ?? "")
    expect(Math.abs(newest - Date.now())).toBeLessThan(10 * 60_000)
    expect(r.facts?.integrity?.resellersWithEvents).toBeGreaterThanOrEqual(1)
    expect(r.facts?.integrity?.topResellerEventShare).toBeGreaterThan(0)
    expect(r.facts?.triggers.map((t) => t.enabled)).toEqual(["O", "O", "O"])
    // never a PASS overall while the migration is not recorded (CI schema comes from the datamodel)
    expect(r.global).not.toBe("PASS")
    const json = JSON.stringify(r)
    for (const id of Object.values(ids)) expect(json).not.toContain(id)
  })

  it("trigger disabled, incorrect or absent → BLOCKED (the catalog sees what the trigger can not)", async () => {
    await base.$executeRawUnsafe('ALTER TABLE "AffiliateProduct" DISABLE TRIGGER "AffiliateProduct_listing_presence_history"')
    try {
      const r = await report()
      expect(check(r, "B_AffiliateProduct_listing_presence_history").status).toBe("BLOCKED")
      expect(check(r, "B_AffiliateProduct_listing_presence_history").evidence.join(" ")).toContain("DÉSACTIVÉ")
      expect(r.global).toBe("BLOCKED")
    } finally {
      await base.$executeRawUnsafe('ALTER TABLE "AffiliateProduct" ENABLE TRIGGER "AffiliateProduct_listing_presence_history"')
    }
    await base.$executeRawUnsafe('DROP TRIGGER "AffiliateProduct_listing_presence_history" ON "AffiliateProduct"')
    await base.$executeRawUnsafe(
      'CREATE TRIGGER "AffiliateProduct_listing_presence_history" AFTER INSERT ON "AffiliateProduct" FOR EACH ROW EXECUTE FUNCTION affisell_record_listing_presence()',
    )
    let r = await report()
    expect(check(r, "B_AffiliateProduct_listing_presence_history").evidence[0]).toMatch(/présent mais incorrect/)
    await base.$executeRawUnsafe('DROP TRIGGER "ListingPresenceEvent_no_truncate" ON "ListingPresenceEvent"')
    r = await report()
    expect(check(r, "B_ListingPresenceEvent_no_truncate").evidence[0]).toBe("absent")
    await apply(MIGRATION) // idempotent re-application restores both, data kept
    r = await report()
    expect(check(r, "B_AffiliateProduct_listing_presence_history").status).toBe("PASS")
    expect(check(r, "B_ListingPresenceEvent_no_truncate").status).toBe("PASS")
  })

  it("a write in replica mode leaves no event; the reconciliation reveals the silent capture afterwards", async () => {
    const before = await base.listingPresenceEvent.count({ where: { affiliateProductId: ids.l2 } })
    let replicaAllowed = true
    try {
      await base.$transaction(async (tx: typeof base) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica")
        await tx.affiliateProduct.update({ where: { id: ids.l2 }, data: { isListed: false } })
      })
    } catch {
      replicaAllowed = false // the CI role may not be allowed to set it: then nothing to observe
    }
    if (!replicaAllowed) return
    expect(await base.listingPresenceEvent.count({ where: { affiliateProductId: ids.l2 } })).toBe(before)
    const r = await report()
    expect(check(r, "B_capture_observed").status).toBe("BLOCKED")
    expect(check(r, "B_capture_observed").evidence.join(" ")).toContain("dernier événement : 1")
    // the report's own session is normal
    expect(check(r, "E_replication_role").evidence[0]).toContain("origin")
    await base.$transaction(async (tx: typeof base) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica")
      await tx.affiliateProduct.update({ where: { id: ids.l2 }, data: { isListed: true } }) // put it back, unrecorded
    })
  })

  it("injected anomalies are counted — orphan, chain break, duplicate, future date, wrong reseller", async () => {
    const raw = (sql: string, ...a: unknown[]) => base.$executeRawUnsafe(sql, ...a)
    const ins = `INSERT INTO "ListingPresenceEvent" ("affiliateProductId","affiliateId","productId","kind","previousListed","newListed","source","effectiveAt") VALUES ($1,$2,$3,$4,$5,$6,'test',$7)`
    await raw(ins, `${stamp}-gone`, ids.a1, ids.product, "listed", false, true, new Date()) // orphan: listing never existed
    await raw(ins, ids.l1, ids.a1, ids.product, "listed", false, true, new Date()) // chain break: already listed
    const last = await base.listingPresenceEvent.findFirst({ where: { affiliateProductId: ids.l2 }, orderBy: { id: "desc" } })
    await raw(ins, ids.l2, ids.a2, ids.product, last.kind, last.previousListed, last.newListed, last.effectiveAt) // duplicate
    await raw(ins, ids.l2, ids.a1, ids.product, "unlisted", true, false, new Date(Date.now() + 86_400_000)) // future + wrong reseller
    const r = await report()
    const all = r.checks.flatMap((c) => c.evidence).join("\n")
    expect(check(r, "C_orphans_isolation").status).toBe("BLOCKED")
    expect(all).toMatch(/annonces disparues sans événement « deleted » \(TRUNCATE, capture muette\) : 1/)
    expect(all).toMatch(/attribués à un autre revendeur ou produit que l'annonce : 1/)
    expect(all).toMatch(/datés dans le futur : 1/)
    expect(check(r, "B_idempotence").status).toBe("BLOCKED")
    expect(check(r, "C_sequences").status).toBe("BLOCKED")
    expect(r.global).toBe("BLOCKED")
    expect(r.anomalies.length).toBeGreaterThan(0)
    const json = JSON.stringify(r)
    for (const id of Object.values(ids)) expect(json).not.toContain(id)
  })
})
