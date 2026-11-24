/**
 * Capture Sentinel on a REAL PostgreSQL (CI job « Money-path tests on a real PostgreSQL »; opt-in locally like every DB
 * test, and only on the disposable test database — the destination is checked by the probe's own rule BEFORE connecting).
 *
 * What must hold:
 *  - a healthy capture → PASS, every step proved by the event read back, in a session at UTC+12:45/+13:45;
 *  - nothing survives the probe, and no commercial table changes (User, Product, AffiliateProduct, Order, AuditLog,
 *    ListingPriceHistory, ListingPresenceEvent);
 *  - a broken capture is caught: trigger absent (missing events), local-time function (UTC), wrong kind (incorrect
 *    event), dropped source (provenance), second trigger (duplicates), refused mutation;
 *  - an interrupted probe (backend killed mid-transaction) leaves nothing;
 *  - committed residue (simulated broken run) is detected by the readiness report and cleaned without touching a real
 *    listing; an interrupted cleanup changes nothing and can be run again.
 * Every fault is injected into the test database and undone by re-applying the migration (idempotent).
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
const MIGRATION_SQL = readFileSync(MIGRATION, "utf8")
const RECORD_FN = statements(MIGRATION_SQL).find((s) => s.includes("CREATE OR REPLACE FUNCTION affisell_record_listing_presence"))!
const stamp = `cs${Date.now().toString(36)}`

describe.skipIf(!RUN_DB)("Capture Sentinel — real database", { timeout: 180_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let base: any
  let sentinel: typeof import("@/lib/listing-presence/capture-sentinel")
  let runner: typeof import("@/lib/listing-presence/capture-sentinel-run")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let destination: any
  const real = { supplier: "", affiliate: "", product: "", listing: "" }

  const apply = async () => {
    for (const s of statements(MIGRATION_SQL)) await base.$executeRawUnsafe(s)
  }
  const probe = (hooks?: Parameters<typeof runner.runCaptureSentinel>[0]["hooks"]) => runner.runCaptureSentinel({ destination, connect: () => base, hooks })
  const status = (r: { checks: Array<{ id: string; status: string }> }, id: string) => r.checks.find((c) => c.id === id)?.status
  const counts = async () => ({
    users: await base.user.count(),
    products: await base.product.count(),
    listings: await base.affiliateProduct.count(),
    orders: await base.order.count(),
    audit: await base.auditLog.count(),
    prices: await base.listingPriceHistory.count(),
    presence: await base.listingPresenceEvent.count(),
  })

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client")
    base = new PrismaClient({ log: [] })
    sentinel = await import("@/lib/listing-presence/capture-sentinel")
    runner = await import("@/lib/listing-presence/capture-sentinel-run")
    // The probe's OWN destination rule, on the URL the guard selected (the CI database is 127.0.0.1/affisell_test).
    destination = sentinel.decideSentinelDestination({ url: process.env.DATABASE_URL, protectedUrls: [], env: process.env })
    expect(destination.allowed).toBe(true)
    await base.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    await apply()
    // One REAL (non-sentinel) listing, as a control the probe and the cleanup must never touch.
    real.supplier = (await base.user.create({ data: { email: `${stamp}-s@affisell.test`, role: "SUPPLIER", name: "s" } })).id
    real.affiliate = (await base.user.create({ data: { email: `${stamp}-a@affisell.test`, role: "AFFILIATE", name: "a" } })).id
    real.product = (await base.product.create({ data: { supplierId: real.supplier, name: "CS", description: "d", basePriceCents: 2000, commissionRate: 10 } })).id
    real.listing = (await base.affiliateProduct.create({ data: { affiliateId: real.affiliate, productId: real.product, sellingPriceCents: 3000 } })).id
  }, 90_000)

  afterAll(async () => {
    if (!base) return
    await base.$executeRawUnsafe('DROP TRIGGER IF EXISTS "zz_capture_sentinel_dup" ON "AffiliateProduct"').catch(() => undefined)
    await base.$executeRawUnsafe('DROP TRIGGER IF EXISTS "zz_capture_sentinel_refuse" ON "AffiliateProduct"').catch(() => undefined)
    await apply().catch(() => undefined)
    await runner.cleanupSentinelResidue({ destination, connect: () => base }).catch(() => undefined)
    await base.affiliateProduct.deleteMany({ where: { productId: real.product } }).catch(() => undefined)
    await base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
      await tx.listingPresenceEvent.deleteMany({ where: { productId: real.product } })
    }).catch(() => undefined)
    await base.listingPriceHistory.deleteMany({ where: { productId: real.product } }).catch(() => undefined)
    await base.product.deleteMany({ where: { id: real.product } }).catch(() => undefined)
    await base.user.deleteMany({ where: { id: { in: [real.supplier, real.affiliate].filter(Boolean) } } }).catch(() => undefined)
    await base.$disconnect()
  })

  it("healthy capture → PASS; every step proved by its event; nothing survives; no commercial table changes (1–5, 10, 18)", async () => {
    const before = await counts()
    const realEventsBefore = await base.listingPresenceEvent.count({ where: { affiliateProductId: real.listing } })
    const r = await probe()
    expect(r.overall, JSON.stringify(r.checks.filter((c) => c.status !== "PASS"))).toBe("PASS")
    for (const id of ["evenement:create", "evenement:list", "evenement:noop", "evenement:unlist", "evenement:delete", "provenance", "utc", "chaine", "etat_final", "annulation", "isolation"]) expect(status(r, id), id).toBe("PASS")
    expect(r.captureDelayMsMax).not.toBeNull()
    expect(r.environment?.kind).toMatch(/^(local|ci)$/)
    expect(await counts()).toEqual(before)
    expect(await base.listingPresenceEvent.count({ where: { affiliateProductId: real.listing } })).toBe(realEventsBefore)
    expect(await runner.readSentinelResidue(base)).toEqual({ listings: 0, events: 0, products: 0, users: 0, priceRows: 0 })
  })

  it("idempotent: two probes in a row both PASS and leave nothing (5)", async () => {
    const before = await counts()
    expect((await probe()).overall).toBe("PASS")
    expect((await probe()).overall).toBe("PASS")
    expect(await counts()).toEqual(before)
  })

  it("trigger absent → FAIL « événement absent » at every step (6)", async () => {
    await base.$executeRawUnsafe('DROP TRIGGER "AffiliateProduct_listing_presence_history" ON "AffiliateProduct"')
    try {
      const r = await probe()
      expect(r.overall).toBe("FAIL")
      expect(r.checks.find((c) => c.id === "evenement:create")?.detail).toMatch(/absent/)
      expect(status(r, "isolation")).toBe("PASS")
    } finally {
      await apply()
    }
  })

  it("function writing LOCAL time instead of UTC → FAIL utc (3)", async () => {
    await base.$executeRawUnsafe(RECORD_FN.replaceAll("(clock_timestamp() AT TIME ZONE 'UTC')", "clock_timestamp()::timestamp"))
    try {
      const r = await probe()
      expect(status(r, "utc")).toBe("FAIL")
      expect(r.overall).toBe("FAIL")
    } finally {
      await apply()
    }
  })

  it("function recording the wrong reseller / product → FAIL « événement incorrect » (7)", async () => {
    await base.$executeRawUnsafe(RECORD_FN.replace('NEW."id", NEW."affiliateId", NEW."productId",\n                CASE', 'NEW."id", NEW."productId", NEW."affiliateId",\n                CASE'))
    try {
      const r = await probe()
      expect(r.checks.find((c) => c.id === "evenement:list")?.detail).toMatch(/incorrect/)
      expect(r.overall).toBe("FAIL")
    } finally {
      await apply()
    }
  })

  it("function recording an impossible kind: the table's shape CHECK makes the mutation fail, and the probe says so (7, 9)", async () => {
    await base.$executeRawUnsafe(RECORD_FN.replace("THEN 'listed' ELSE 'unlisted' END", "THEN 'unlisted' ELSE 'listed' END"))
    try {
      const r = await probe()
      expect(r.checks.find((c) => c.id === "mutation:list")?.status).toBe("FAIL")
      expect(r.overall).toBe("FAIL")
      expect(r.checks.find((c) => c.id === "isolation")?.status).toBe("PASS")
    } finally {
      await apply()
    }
  })

  it("function ignoring the declared source → FAIL provenance (2)", async () => {
    await base.$executeRawUnsafe(RECORD_FN.replaceAll("v_source, v_actor,", "'unattributed', NULL,"))
    try {
      const r = await probe()
      expect(status(r, "provenance")).toBe("FAIL")
    } finally {
      await apply()
    }
  })

  it("a second trigger → FAIL « doublon » (8)", async () => {
    await base.$executeRawUnsafe('CREATE TRIGGER "zz_capture_sentinel_dup" AFTER INSERT OR DELETE OR UPDATE OF "isListed" ON "AffiliateProduct" FOR EACH ROW EXECUTE FUNCTION affisell_record_listing_presence()')
    try {
      const r = await probe()
      expect(r.checks.find((c) => c.id === "evenement:create")?.detail).toMatch(/doublon/)
      expect(r.overall).toBe("FAIL")
    } finally {
      await base.$executeRawUnsafe('DROP TRIGGER IF EXISTS "zz_capture_sentinel_dup" ON "AffiliateProduct"')
    }
  })

  it("a mutation the database refuses → FAIL, no event, later steps not run, nothing left (9, 10)", async () => {
    await base.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION zz_capture_sentinel_refuse() RETURNS trigger AS $$ BEGIN
        IF NEW.id LIKE 'capture-sentinel-%' AND NEW."isListed" THEN RAISE EXCEPTION 'refused by test'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`)
    await base.$executeRawUnsafe('CREATE TRIGGER "zz_capture_sentinel_refuse" BEFORE UPDATE ON "AffiliateProduct" FOR EACH ROW EXECUTE FUNCTION zz_capture_sentinel_refuse()')
    try {
      const r = await probe()
      expect(status(r, "mutation:list")).toBe("FAIL")
      expect(status(r, "evenement:list")).toBe("PASS") // no event for a refused mutation
      expect(status(r, "mutation:unlist")).toBe("NOT_RUN")
      expect(status(r, "isolation")).toBe("PASS")
      expect(r.overall).toBe("FAIL")
    } finally {
      await base.$executeRawUnsafe('DROP TRIGGER IF EXISTS "zz_capture_sentinel_refuse" ON "AffiliateProduct"')
      await base.$executeRawUnsafe("DROP FUNCTION IF EXISTS zz_capture_sentinel_refuse()")
    }
  })

  it("probe interrupted mid-transaction (backend killed) → not PASS, and PostgreSQL left nothing (12)", async () => {
    const { PrismaClient } = await import("@prisma/client")
    const killer = new PrismaClient({ log: [] })
    const victim = new PrismaClient({ log: [] })
    try {
      const before = await counts()
      const r = await runner.runCaptureSentinel({
        destination,
        connect: () => victim,
        hooks: {
          afterStep: async (step, tx) => {
            if (step !== "list") return
            const [{ pid }] = (await tx.$queryRaw`SELECT pg_backend_pid() AS pid`) as Array<{ pid: number }>
            await killer.$queryRaw`SELECT pg_terminate_backend(${pid}::int)::text AS k`
          },
        },
      })
      expect(r.overall).not.toBe("PASS")
      expect(await runner.readSentinelResidue(killer)).toEqual({ listings: 0, events: 0, products: 0, users: 0, priceRows: 0 })
      expect(await counts()).toEqual(before)
    } finally {
      await victim.$disconnect().catch(() => undefined)
      await killer.$disconnect()
    }
  })

  it("committed residue is reported by the readiness facts, then cleaned — the real listing is untouched (11)", async () => {
    // A BROKEN run that committed (simulated): sentinel ids AND the sentinel source.
    const ids = sentinel.sentinelIds(`${stamp}r`)
    await base.user.create({ data: { id: ids.supplierId, email: `${ids.supplierId}@sentinel.invalid`, role: "SUPPLIER", name: "capture-sentinel" } })
    await base.user.create({ data: { id: ids.affiliateId, email: `${ids.affiliateId}@sentinel.invalid`, role: "AFFILIATE", name: "capture-sentinel" } })
    await base.product.create({ data: { id: ids.productId, supplierId: ids.supplierId, name: "capture-sentinel", description: "x", basePriceCents: 1000, commissionRate: 10 } })
    await base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_source', 'capture_sentinel', true)::text AS s`
      await tx.affiliateProduct.create({ data: { id: ids.listingId, affiliateId: ids.affiliateId, productId: ids.productId, sellingPriceCents: 1000, isListed: false } })
    })
    const residue = await runner.readSentinelResidue(base)
    expect(residue.listings).toBe(1)
    expect(residue.events).toBeGreaterThan(0)

    const run = await import("@/lib/strategic-intelligence/fee-reconciliation-run")
    const collector = await import("@/lib/reports/presence-readiness-report")
    const facts = await run.withReadOnlyTransaction(run.readOnlyPrismaClient(base), (tx) => collector.collectIntegrityFacts(tx, null))
    expect(facts.sentinelResidueListings).toBe(1)
    expect(facts.bySource.capture_sentinel).toBeGreaterThan(0)

    const realEvents = await base.listingPresenceEvent.count({ where: { affiliateProductId: real.listing } })
    const c = await runner.cleanupSentinelResidue({ destination, connect: () => base })
    expect(c.done).toBe(true)
    expect(await runner.readSentinelResidue(base)).toEqual({ listings: 0, events: 0, products: 0, users: 0, priceRows: 0 })
    expect(await base.affiliateProduct.count({ where: { id: real.listing } })).toBe(1)
    expect(await base.listingPresenceEvent.count({ where: { affiliateProductId: real.listing } })).toBe(realEvents)
  })

  it("an interrupted cleanup changes nothing; running it again finishes it (12)", async () => {
    const ids = sentinel.sentinelIds(`${stamp}i`)
    await base.user.create({ data: { id: ids.supplierId, email: `${ids.supplierId}@sentinel.invalid`, role: "SUPPLIER", name: "capture-sentinel" } })
    await base.user.create({ data: { id: ids.affiliateId, email: `${ids.affiliateId}@sentinel.invalid`, role: "AFFILIATE", name: "capture-sentinel" } })
    await base.product.create({ data: { id: ids.productId, supplierId: ids.supplierId, name: "capture-sentinel", description: "x", basePriceCents: 1000, commissionRate: 10 } })
    await base.$transaction(async (tx: typeof base) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_source', 'capture_sentinel', true)::text AS s`
      await tx.affiliateProduct.create({ data: { id: ids.listingId, affiliateId: ids.affiliateId, productId: ids.productId, sellingPriceCents: 1000, isListed: false } })
    })
    const before = await runner.readSentinelResidue(base)
    await expect(
      runner.cleanupSentinelResidue({ destination, connect: () => base, hooks: { afterListings: async () => { throw new Error("interrupted by test") } } }),
    ).rejects.toThrow("interrupted by test")
    expect(await runner.readSentinelResidue(base)).toEqual(before)
    const again = await runner.cleanupSentinelResidue({ destination, connect: () => base })
    expect(again.done).toBe(true)
    expect(await runner.readSentinelResidue(base)).toEqual({ listings: 0, events: 0, products: 0, users: 0, priceRows: 0 })
  })

  it("the probe refuses this very database under another name, and never connects (14, 17)", async () => {
    const other = String(process.env.DATABASE_URL).replace(/\/[^/?]+(\?|$)/, "/affisell$1")
    const connect = vi.fn(() => base)
    const r = await runner.runCaptureSentinel({ destination: sentinel.decideSentinelDestination({ url: other, protectedUrls: [], env: process.env }), connect })
    expect(r.overall).toBe("NOT_RUN")
    expect(connect).not.toHaveBeenCalled()
  })
})
