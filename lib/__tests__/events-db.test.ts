/**
 * The event spine against a REAL database (test database only — see lib/testing/db-test-guard.ts).
 * Proves what a mocked client cannot: the unique idempotency key, the CHECK constraints that keep the two classes apart,
 * and that the existing readers' queries still work with the new columns.
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/events-db.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = Date.now()
const key = (tag: string) => `s1test_${stamp}_${tag}`
const ANON = "0b9f7c3e-6c1a-4f5e-9d2b-1a2b3c4d5e6f"
const PRODUCT = `s1prod_${stamp}`

describe.skipIf(!RUN_DB)("event spine — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let recordEvents: (typeof import("@/lib/events/record.server"))["recordEvents"]
  const legacyIds: string[] = []

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ recordEvents } = await import("@/lib/events/record.server"))
  })

  afterAll(async () => {
    await prisma.affisellTrackEvent.deleteMany({ where: { OR: [{ eventId: { startsWith: `s1test_${stamp}` } }, { productId: PRODUCT }, { id: { in: legacyIds } }] } })
    await prisma.$disconnect()
  })

  const rowsFor = (prefix: string) => prisma.affisellTrackEvent.findMany({ where: { eventId: { startsWith: key(prefix) } } })

  it("stores both classes; the transactional row carries no visitor identifier", async () => {
    const r = await recordEvents(
      [
        { eventId: key("a-view"), name: "product_view", anonymousId: ANON, sessionId: "sess_abcdef12", productId: PRODUCT, channel: "social", country: "fr", locale: "fr", properties: { surface: "pdp" } },
        { eventId: key("a-purchase"), name: "purchase", anonymousId: ANON, sessionId: "sess_abcdef12", orderId: "cmorder0000000000000001", productId: PRODUCT, properties: { amount_cents: 4990, currency: "eur" } },
      ],
      { analyticsConsent: true }
    )
    expect(r).toMatchObject({ written: 2, error: null })

    const rows = await rowsFor("a-")
    const view = rows.find((x) => x.eventType === "product_view")!
    const purchase = rows.find((x) => x.eventType === "purchase")!
    expect(view).toMatchObject({ eventClass: "behavioral", anonymousId: ANON, sessionId: "sess_abcdef12", channel: "social", country: "FR", schemaVersion: 1, properties: { surface: "pdp" } })
    expect(purchase).toMatchObject({ eventClass: "transactional", anonymousId: null, sessionId: null, channel: null, orderId: "cmorder0000000000000001", properties: { amount_cents: 4990, currency: "EUR" } })
    expect(view.occurredAt).toBeInstanceOf(Date)
  })

  it("without consent only the business fact exists", async () => {
    const r = await recordEvents(
      [
        { eventId: key("b-view"), name: "product_view", anonymousId: ANON },
        { eventId: key("b-refund"), name: "refund", orderId: "cmorder0000000000000002", properties: { amount_cents: 1000 } },
      ],
      { analyticsConsent: false }
    )
    expect(r).toMatchObject({ written: 1, dropped: { no_consent: 1 } })
    expect((await rowsFor("b-")).map((x) => x.eventType)).toEqual(["refund"])
  })

  it("a replay creates nothing: same keys, same rows", async () => {
    const batch = [
      { eventId: key("c-1"), name: "purchase", orderId: "cmorder0000000000000003" },
      { eventId: key("c-2"), name: "refund", orderId: "cmorder0000000000000003" },
    ]
    expect((await recordEvents(batch, { analyticsConsent: false })).written).toBe(2)
    const replay = await recordEvents(batch, { analyticsConsent: false })
    expect(replay).toMatchObject({ written: 0, duplicates: 2, error: null })
    expect(await rowsFor("c-")).toHaveLength(2)
  })

  it("two concurrent writers of the same event leave exactly one row (the unique index decides, not the application)", async () => {
    const ev = { eventId: key("d-race"), name: "purchase", orderId: "cmorder0000000000000004" }
    const results = await Promise.all(Array.from({ length: 6 }, () => recordEvents([ev], { analyticsConsent: false })))
    expect(results.every((r) => r.error === null)).toBe(true)
    expect(results.reduce((n, r) => n + r.written, 0)).toBe(1)
    expect(await rowsFor("d-")).toHaveLength(1)
  })

  describe("the database itself refuses what the application must never write", () => {
    const base = { eventType: "purchase", eventId: "x", eventClass: "transactional" as const }

    it("a business row with a visitor identifier", async () => {
      await expect(prisma.affisellTrackEvent.create({ data: { ...base, eventId: key("e-1"), anonymousId: ANON } })).rejects.toThrow()
      await expect(prisma.affisellTrackEvent.create({ data: { ...base, eventId: key("e-2"), sessionId: "sess_abcdef12" } })).rejects.toThrow()
      expect(await rowsFor("e-")).toHaveLength(0)
    })

    it("an unknown class", async () => {
      await expect(prisma.affisellTrackEvent.create({ data: { ...base, eventId: key("e-3"), eventClass: "marketing" } })).rejects.toThrow()
    })

    it("a spine row without an idempotency key", async () => {
      await expect(prisma.affisellTrackEvent.create({ data: { eventType: "product_view", eventClass: "behavioral", productId: PRODUCT } })).rejects.toThrow()
    })

    it("a second row with the same idempotency key", async () => {
      await prisma.affisellTrackEvent.create({ data: { ...base, eventId: key("e-4") } })
      await expect(prisma.affisellTrackEvent.create({ data: { ...base, eventId: key("e-4") } })).rejects.toThrow()
    })
  })

  describe("the existing writers and readers are unaffected", () => {
    it("a legacy-shaped row (no spine column) is still valid and has no class", async () => {
      const row = await prisma.affisellTrackEvent.create({ data: { eventType: "view", productId: PRODUCT, sessionId: "legacy-session-1" } })
      legacyIds.push(row.id)
      expect(row).toMatchObject({ eventClass: null, eventId: null, anonymousId: null, schemaVersion: null })
    })

    it("the queries of the readers still run and still see legacy rows", async () => {
      const since = new Date(Date.now() - 60_000)
      const count = await prisma.affisellTrackEvent.count({ where: { eventType: "view", productId: PRODUCT, createdAt: { gte: since } } })
      expect(count).toBeGreaterThanOrEqual(1)
      const grouped = await prisma.affisellTrackEvent.groupBy({ by: ["productId"], where: { eventType: "view", productId: { in: [PRODUCT] }, createdAt: { gte: since } }, _count: { id: true } })
      expect(grouped[0]?._count.id).toBeGreaterThanOrEqual(1)
      const viewers = await prisma.affisellTrackEvent.findMany({ where: { eventType: "view", productId: PRODUCT, userId: { not: null } }, select: { userId: true }, distinct: ["userId"], take: 200 })
      expect(Array.isArray(viewers)).toBe(true)
    })
  })
})
