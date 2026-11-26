/**
 * Historical exposure on a REAL PostgreSQL: the database trigger (migration 20261124090000) writes the presence events
 * — in a NON-UTC session, with a withdrawal, a relisting and a deletion — and the shared measure
 * (`lib/listing-presence/exposure.ts`) reads them back through the real `rebuildPresence`. What must hold:
 *  - listed time = exactly the time between the recorded events while listed; the withdrawn gap is not exposure;
 *  - instants are UTC whatever the session time zone (Asia/Tokyo here): every event falls between the JS clock
 *    readings taken around its write;
 *  - a sale is counted only inside a known listed period of ITS shop; another shop's listing never reaches a case;
 *  - the quality measure and the copilot learning count the same listed time for the same listing.
 * Opt-in (RUN_DB_TESTS=1 + DATABASE_URL_TEST); runs in the CI job « Money-path tests on a real PostgreSQL ».
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
const stamp = `hx${Date.now().toString(36)}`

describe.skipIf(!RUN_DB)("historical exposure — real database", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let periods: typeof import("@/lib/listing-presence/periods")
  let exposure: typeof import("@/lib/listing-presence/exposure")
  let quality: typeof import("@/lib/listing-quality/quality-effect")
  let learningX: typeof import("@/lib/reseller-copilot/learning-exposure")
  const ids = { supplier: "", a: "", b: "", product: "", listingA: "", listingB: "" }
  const marks: Date[] = []
  let trackingStartedAt = new Date()

  const tokyo = <T,>(op: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Tokyo'")
      return op(tx)
    })
  const pause = () => prisma.$queryRawUnsafe("SELECT pg_sleep(0.08)::text AS s")
  const historyOf = async (listingId: string, current: { isListed: boolean; createdAt: Date } | null) => {
    const rows = await prisma.listingPresenceEvent.findMany({ where: { affiliateProductId: listingId }, orderBy: { id: "asc" } })
    return {
      rows,
      history: periods.rebuildPresence({
        current,
        events: rows.map((r) => ({ kind: r.kind as "created" | "listed" | "unlisted" | "deleted", previousListed: r.previousListed, newListed: r.newListed, effectiveAt: r.effectiveAt, source: r.source })),
        trackingStartedAt,
      }),
    }
  }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    periods = await import("@/lib/listing-presence/periods")
    exposure = await import("@/lib/listing-presence/exposure")
    quality = await import("@/lib/listing-quality/quality-effect")
    learningX = await import("@/lib/reseller-copilot/learning-exposure")
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ListingPresenceEvent" CASCADE')
    for (const s of statements(readFileSync(MIGRATION, "utf8"))) await prisma.$executeRawUnsafe(s)
    trackingStartedAt = new Date(Date.now() - 1_000)
    const mk = (tag: string, role: "SUPPLIER" | "AFFILIATE") => prisma.user.create({ data: { email: `${stamp}-${tag}@affisell.test`, role, name: tag } })
    ids.supplier = (await mk("s", "SUPPLIER")).id
    ids.a = (await mk("a", "AFFILIATE")).id
    ids.b = (await mk("b", "AFFILIATE")).id
    ids.product = (await prisma.product.create({ data: { supplierId: ids.supplier, name: "HX", description: "d", basePriceCents: 2000, commissionRate: 10 } as never })).id
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.affiliateProduct.deleteMany({ where: { productId: ids.product } })
    await prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
        await tx.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "productId" = ${ids.product}`
      })
      .catch(() => undefined)
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.a, ids.b] } } })
    await prisma.$disconnect()
  })

  it("listed time = the recorded listed intervals; the withdrawn gap is not exposure; instants are UTC", async () => {
    marks.push(new Date())
    ids.listingA = (await tokyo((tx) => tx.affiliateProduct.create({ data: { affiliateId: ids.a, productId: ids.product, sellingPriceCents: 3000 } }))).id
    await pause()
    await tokyo((tx) => tx.affiliateProduct.update({ where: { id: ids.listingA }, data: { isListed: false } }))
    await pause()
    await tokyo((tx) => tx.affiliateProduct.update({ where: { id: ids.listingA }, data: { isListed: true } }))
    await pause()
    await tokyo((tx) => tx.affiliateProduct.delete({ where: { id: ids.listingA } }))
    marks.push(new Date())
    const { rows, history } = await historyOf(ids.listingA, null)
    expect(rows.map((r) => r.kind)).toEqual(["created", "unlisted", "listed", "deleted"])
    for (const r of rows) {
      // Tokyo is UTC+9: a local-time write would be 9 h off.
      expect(r.effectiveAt.getTime()).toBeGreaterThanOrEqual(marks[0]!.getTime() - 2_000)
      expect(r.effectiveAt.getTime()).toBeLessThanOrEqual(marks[1]!.getTime() + 2_000)
    }
    const t = rows.map((r) => r.effectiveAt.getTime())
    const from = new Date(marks[0]!.getTime() - 5_000)
    const to = new Date(marks[1]!.getTime() + 5_000)
    const [shop] = exposure.shopExposures([{ affiliateId: ids.a, history }], from, to)
    const expectedMs = t[1]! - t[0]! + (t[3]! - t[2]!)
    const gotMs = shop!.intervals.reduce((s, [lo, hi]) => s + (hi - lo), 0)
    expect(gotMs).toBe(expectedMs)
    expect(shop).toMatchObject({ withdrawals: 2, relistings: 1, unknownDays: 0, anomaly: false })
  })

  it("a sale counts only inside its shop's known listed period; another shop's listing never reaches a case", async () => {
    ids.listingB = (await prisma.affiliateProduct.create({ data: { affiliateId: ids.b, productId: ids.product, sellingPriceCents: 3000 } })).id
    const a = await historyOf(ids.listingA, null)
    const b = await historyOf(ids.listingB, { isListed: true, createdAt: new Date() })
    const t = a.rows.map((r) => r.effectiveAt.getTime())
    const inGap = new Date(Math.floor((t[1]! + t[2]!) / 2))
    const inFirst = new Date(Math.floor((t[0]! + t[1]!) / 2))
    const listings = [
      { affiliateId: ids.a, productId: ids.product, history: a.history },
      { affiliateId: ids.b, productId: ids.product, history: b.history },
    ]
    const from = new Date(marks[0]!.getTime() - 5_000)
    const to = new Date(Date.now() + 5_000)
    const { exposure: ex } = quality.historicalQualityExposure({
      productIds: [ids.product],
      presence: new Map([[ids.product, listings.map(({ affiliateId, history }) => ({ affiliateId, history }))]]),
      orders: [
        { productId: ids.product, affiliateId: ids.a, paidAt: inFirst, quantity: 1, closed: false },
        { productId: ids.product, affiliateId: ids.a, paidAt: inGap, quantity: 1, closed: false }, // shop a was withdrawn
      ],
      from,
      to,
    })
    expect(ex.get(ids.product)).toMatchObject({ paidOrders: 1, ordersOutsideKnownPeriods: 1, resellersListing: 2 })
    expect(learningX.presenceForCase(listings, ids.a, ids.product)).toEqual([a.history])
    expect(learningX.presenceForCase(listings, ids.b, ids.product)).toEqual([b.history])
  })
})
