/**
 * Mutation / history reconciliation on a REAL PostgreSQL (CI job « Money-path tests on a real PostgreSQL »; opt-in
 * locally on the disposable test database only).
 *
 * Both triggers are installed from their migrations: presence history AND price history (the independent creation
 * witness). The collector runs exactly as `report:presence-readiness` runs it — through the read-only client, inside a
 * `SET TRANSACTION READ ONLY` transaction.
 *
 * What must hold:
 *  - normal mutations (declared creations, a logged withdrawal) reconcile, no loss, rates with their denominator;
 *  - with the presence trigger DISABLED, real mutations leave witnesses without events and every kind of loss is
 *    CONFIRMED (creation, logged withdrawal, contradicting state, created without « created », deletion without event);
 *  - the readiness check turns BLOCKED and a snapshot built from that report carries the blocking anomaly;
 *  - the reconciliation itself writes nothing.
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

const PRESENCE = path.join(process.cwd(), "prisma/migrations/20261124090000_listing_presence_history/migration.sql")
const PRICE = path.join(process.cwd(), "prisma/migrations/20261117090000_listing_price_history/migration.sql")
const ROLLBACK = path.join(process.cwd(), "scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql")
const stamp = `mr${Date.now().toString(36)}`

describe.skipIf(!RUN_DB)("mutation / history reconciliation — real database", { timeout: 180_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let base: any
  let run: typeof import("@/lib/strategic-intelligence/fee-reconciliation-run")
  let collector: typeof import("@/lib/reports/presence-readiness-report")
  let monitor: typeof import("@/lib/launch-gate/collection-monitor")
  const ids = { supplier: "", affiliate: "", product: "", a: "", w: "", c: "", b: "" }
  let trackingStart = new Date()
  const staticFacts = { migrationFilePresent: true, migrationSql: readFileSync(PRESENCE, "utf8"), rollbackSql: readFileSync(ROLLBACK, "utf8") }

  const apply = async (file: string) => {
    for (const s of statements(readFileSync(file, "utf8"))) await base.$executeRawUnsafe(s)
  }
  const reconcile = () =>
    run.withReadOnlyTransaction(run.readOnlyPrismaClient(base), async (tx) => {
      const integrity = await collector.collectIntegrityFacts(tx, trackingStart)
      return collector.collectReconciliation(tx, trackingStart, new Date(), integrity)
    })
  const report = () =>
    run.withReadOnlyTransaction(run.readOnlyPrismaClient(base), (tx) => collector.collectPresenceReadiness(tx, { staticFacts, trackingStartOverride: trackingStart }))
  const createListing = (listed: boolean) =>
    base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_source', 'listing_create', true)::text AS s`
      return tx.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 2500, isListed: listed } })
    })
  // The replacement flow's own shape: source declared, update, AuditLog in the SAME transaction.
  const withdraw = (listingId: string) =>
    base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_source', 'replacement', true)::text AS s`
      await tx.affiliateProduct.updateMany({ where: { id: listingId }, data: { isListed: false } })
      await tx.auditLog.create({ data: { action: "affiliate.listing_withdrawn", entityType: "AffiliateProduct", entityId: listingId, actorId: ids.affiliate, payload: { via: "test" } } })
    })

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client")
    base = new PrismaClient({ log: [] })
    run = await import("@/lib/strategic-intelligence/fee-reconciliation-run")
    collector = await import("@/lib/reports/presence-readiness-report")
    monitor = await import("@/lib/launch-gate/collection-monitor")
    await base.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    await apply(PRICE)
    await apply(PRESENCE)
    trackingStart = new Date(Date.now() - 1000)
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") => base.user.create({ data: { email: `${stamp}-${tag}@affisell.test`, role, name: tag } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.affiliate = (await mk("a", "AFFILIATE")).id
    ids.product = (await base.product.create({ data: { supplierId: ids.supplier, name: "MR", description: "d", basePriceCents: 2000, commissionRate: 10 } })).id
  }, 90_000)

  afterAll(async () => {
    if (!base) return
    await base.$executeRawUnsafe('ALTER TABLE "AffiliateProduct" ENABLE TRIGGER "AffiliateProduct_listing_presence_history"').catch(() => undefined)
    await base.affiliateProduct.deleteMany({ where: { productId: ids.product } }).catch(() => undefined)
    await base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
      await tx.listingPresenceEvent.deleteMany({ where: { productId: ids.product } })
    }).catch(() => undefined)
    await base.listingPriceHistory.deleteMany({ where: { productId: ids.product } }).catch(() => undefined)
    await base.auditLog.deleteMany({ where: { actorId: ids.affiliate } }).catch(() => undefined)
    await base.product.deleteMany({ where: { id: ids.product } }).catch(() => undefined)
    await base.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate].filter(Boolean) } } }).catch(() => undefined)
    await base.$disconnect()
  })

  it("normal mutations reconcile: creations via the price witness, the logged withdrawal, the current state", async () => {
    ids.a = (await createListing(true)).id
    ids.w = (await createListing(true)).id
    ids.c = (await createListing(true)).id
    await withdraw(ids.w)
    const r = await reconcile()
    expect(r.period.clockMarginHours, "the CI database's default time zone is UTC").toBe(0)
    const creation = r.classes.find((c) => c.witnessClass === "creation_prix")!
    expect(creation.available).toBe(true)
    expect(creation.outcomes.rapprochee).toBeGreaterThanOrEqual(3)
    expect(creation.outcomes.manquante).toBe(0)
    const wd = r.classes.find((c) => c.witnessClass === "retrait_journalise")!
    expect(wd.outcomes.rapprochee).toBe(1)
    expect(r.confirmed).toEqual({ creationsSansEvenement: 0, retraitsSansEvenement: 0, etatContreditHistorique: 0, creeesSansCreated: 0, suppressionsSansEvenement: 0 })
    expect(["aucune_anomalie_sur_le_perimetre_verifie", "attribution_a_verifier"]).toContain(r.verdict)
    expect(creation.rate?.denominator).toBe(creation.verifiable)
    expect(r.eventSide).not.toBeNull()
  })

  it("trigger disabled → every kind of loss CONFIRMED, dated, and the readiness check / snapshot block", async () => {
    await base.$executeRawUnsafe('ALTER TABLE "AffiliateProduct" DISABLE TRIGGER "AffiliateProduct_listing_presence_history"')
    try {
      ids.b = (await createListing(true)).id // price witness, no « created »
      await withdraw(ids.a) // logged withdrawal of a listed listing, no « unlisted »
      await base.affiliateProduct.delete({ where: { id: ids.c } }) // gone, history never says « deleted »
    } finally {
      await base.$executeRawUnsafe('ALTER TABLE "AffiliateProduct" ENABLE TRIGGER "AffiliateProduct_listing_presence_history"')
    }
    const before = { listings: await base.affiliateProduct.count(), events: await base.listingPresenceEvent.count(), audit: await base.auditLog.count(), prices: await base.listingPriceHistory.count() }
    const r = await reconcile()
    expect(r.verdict).toBe("anomalies_confirmees")
    expect(r.confirmed.creationsSansEvenement).toBe(1)
    expect(r.confirmed.retraitsSansEvenement).toBe(1)
    expect(r.confirmed.etatContreditHistorique).toBe(1) // a: unlisted now, history says listed
    expect(r.confirmed.creeesSansCreated).toBe(1) // b
    expect(r.confirmed.suppressionsSansEvenement).toBe(1) // c
    expect(r.degradation.firstMissingDay).toBe(new Date().toISOString().slice(0, 10))
    expect(r.degradation.quarantineDays.length).toBe(1)
    // The reconciliation wrote nothing.
    expect({ listings: await base.affiliateProduct.count(), events: await base.listingPresenceEvent.count(), audit: await base.auditLog.count(), prices: await base.listingPriceHistory.count() }).toEqual(before)

    const rep = await report()
    expect(rep.checks.find((c) => c.id === "C_rapprochement_mutations")).toMatchObject({ status: "BLOCKED", critical: false })
    expect(rep.facts?.reconciliation?.confirmedMissing).toBe(5)
    const snap = monitor.buildCollectionSnapshot({ readiness: { ...rep, target: { branch: "staging", endpoint: "ep-shy-wind-test01" } }, appCommit: "bd58113bc", takenAt: new Date(), label: "controle" })
    expect(snap.anomalies.find((a) => a.code === "mutations_sans_evenement")?.severity).toBe("bloquant")
    expect(snap.reconciliation?.confirmedMissing).toBe(5)
  })
})
