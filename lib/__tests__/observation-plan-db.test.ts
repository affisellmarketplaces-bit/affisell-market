/**
 * Observation plan on a REAL PostgreSQL (CI job « Money-path tests on a real PostgreSQL »; opt-in RUN_DB_TESTS=1 +
 * DATABASE_URL_TEST). Proves, with the real presence trigger and the real marker writes:
 *  - a plan marker and its evaluation marker are written ONCE (deterministic ids + skipDuplicates), concurrent reads too;
 *  - the status follows the listing's REAL presence events: evaluation once the horizon is reached, « retiré » after a
 *    withdrawal (trigger event), back in the evaluation after a relisting;
 *  - another reseller reads nothing (not its listing, not its marker).
 * The history start is normally the migration's finished_at in _prisma_migrations, which this test must not write:
 * `loadListingPresence` is replaced by the same read with a fixed start; everything else is the real code.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const DAY = 86_400_000
const TRACKING = new Date(Date.now() - 90 * DAY)

vi.mock("@/lib/listing-presence/presence.server", async () => {
  const { prisma } = await import("@/lib/prisma")
  const { rebuildPresence } = await import("@/lib/listing-presence/periods")
  return {
    loadListingPresence: async (affiliateId: string, listingId: string) => {
      const l = await prisma.affiliateProduct.findFirst({ where: { id: listingId, affiliateId }, select: { isListed: true, createdAt: true } })
      if (!l) return null
      const rows = await prisma.listingPresenceEvent.findMany({ where: { affiliateProductId: listingId, affiliateId }, orderBy: { id: "asc" } })
      return {
        available: true,
        listingId,
        trackingStartedAt: TRACKING,
        history: rebuildPresence({
          current: { isListed: l.isListed, createdAt: l.createdAt },
          events: rows.map((r) => ({ kind: r.kind as "created", previousListed: r.previousListed, newListed: r.newListed, effectiveAt: r.effectiveAt, source: r.source })),
          trackingStartedAt: TRACKING,
        }),
      }
    },
    loadPresenceForProducts: async () => ({ available: false, truncated: false, trackingStartedAt: null, listings: [] }),
  }
})

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
const stamp = `op${Date.now().toString(36)}`

describe.skipIf(!RUN_DB)("Observation plan — real database", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let server: typeof import("@/lib/reseller-copilot/observation-plan.server")
  let plan: typeof import("@/lib/reseller-copilot/observation-plan")
  const ids = { supplier: "", affiliate: "", other: "", product: "", listing: "" }

  beforeAll(async () => {
    process.env.OBSERVATION_PLAN_MODE = "on"
    ;({ prisma } = await import("@/lib/prisma"))
    server = await import("@/lib/reseller-copilot/observation-plan.server")
    plan = await import("@/lib/reseller-copilot/observation-plan")
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    for (const s of statements(readFileSync(MIGRATION, "utf8"))) await prisma.$executeRawUnsafe(s)
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") => prisma.user.create({ data: { email: `${stamp}-${tag}@affisell.test`, role, name: tag } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.affiliate = (await mk("a", "AFFILIATE")).id
    ids.other = (await mk("b", "AFFILIATE")).id
    ids.product = (await prisma.product.create({ data: { supplierId: ids.supplier, name: "OP", description: "d", basePriceCents: 2000, commissionRate: 10, stock: 40 } as never })).id
    ids.listing = (await prisma.affiliateProduct.create({ data: { affiliateId: ids.affiliate, productId: ids.product, sellingPriceCents: 2600 } })).id
    // The listing went on sale 30 days ago: the trigger's own « created » event is moved back by a purge + re-insert.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
      await tx.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "affiliateProductId" = ${ids.listing}`
    })
    await prisma.$executeRaw`INSERT INTO "ListingPresenceEvent" ("affiliateProductId","affiliateId","productId","kind","previousListed","newListed","source","effectiveAt")
      VALUES (${ids.listing}, ${ids.affiliate}, ${ids.product}, 'created', NULL, true, 'listing_create', ${new Date(Date.now() - 30 * DAY)})`
    const plannedAt = new Date(Date.now() - 30 * DAY)
    const reference = plan.pickReference({
      product: Array.from({ length: 40 }, (_, i) => ({ productId: "x", affiliateId: `r${i % 6}`, start: 0, end: null, days: 90, orders: 1, closedOrders: 0, netCents: 0, firstSaleAfterDays: [5, 12, 18, 22, 26, 30][i % 6]!, ongoing: true, isRelisting: false, withdrawal: null, deleted: false })),
      category: [],
      general: [],
    })
    const marker = plan.buildPlanMarker("shown", plan.planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference, now: plannedAt }), { productId: ids.product, categoryId: null }, plannedAt)
    const row = { id: plan.planMarkerId(ids.listing, plannedAt.toISOString().slice(0, 10)), action: plan.PLAN_ACTION, entityType: "AffiliateProduct", entityId: ids.listing, actorId: ids.affiliate, payload: marker }
    await prisma.auditLog.createMany({ data: [row], skipDuplicates: true })
    await prisma.auditLog.createMany({ data: [row], skipDuplicates: true })
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.auditLog.deleteMany({ where: { entityId: ids.listing } })
    await prisma.affiliateProduct.deleteMany({ where: { productId: ids.product } })
    await prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
        await tx.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "productId" = ${ids.product}`
      })
      .catch(() => undefined)
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.affiliate, ids.other] } } })
    await prisma.$disconnect()
    delete process.env.OBSERVATION_PLAN_MODE
  })

  it("the plan marker exists once", async () => {
    expect(await prisma.auditLog.count({ where: { action: "copilot.observation_plan", entityId: ids.listing } })).toBe(1)
  })

  it("horizon reached without a sale → evaluation, its marker written once even under concurrent reads", async () => {
    const views = await Promise.all([1, 2, 3].map(() => server.loadListingPlanStatus(ids.affiliate, ids.listing)))
    for (const v of views) expect(v?.status).toMatchObject({ phase: "evaluation", recommendation: "surveiller", sales: 0 })
    expect(views[0]!.status.elapsedDays).toBeGreaterThanOrEqual(29)
    expect(await prisma.auditLog.count({ where: { action: "copilot.observation_plan_evaluated", entityId: ids.listing } })).toBe(1)
  })

  it("another reseller reads nothing", async () => {
    expect(await server.loadListingPlanStatus(ids.other, ids.listing)).toBeNull()
  })

  it("follows real withdrawals and relistings recorded by the trigger", async () => {
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: false } })
    expect((await server.loadListingPlanStatus(ids.affiliate, ids.listing))?.status.phase).toBe("retire")
    await prisma.affiliateProduct.update({ where: { id: ids.listing }, data: { isListed: true } })
    const back = await server.loadListingPlanStatus(ids.affiliate, ids.listing)
    expect(back?.status.phase).toBe("evaluation")
    const kinds = (await prisma.listingPresenceEvent.findMany({ where: { affiliateProductId: ids.listing }, orderBy: { id: "asc" } })).map((e) => e.kind)
    expect(kinds).toEqual(["created", "unlisted", "listed"])
  })
})
