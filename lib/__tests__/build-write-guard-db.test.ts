/**
 * The build write guard against a REAL database (test database only — see lib/testing/db-test-guard.ts).
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/build-write-guard-db.test.ts
 *
 * The refused writes are REAL inserts carrying a unique marker (`eventType`). If the guard failed, a row with that marker
 * would exist: that is the proof, and it cannot be disturbed by other test files writing to the same table in parallel
 * (a plain before/after row count was — events-db.test.ts writes to AffisellTrackEvent too). Other "writes" are either
 * data the database could never store (validation error) or SQL that is harmless even if the guard failed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const guardMessage = /\[build-guard\]/

async function failure(op: () => Promise<unknown>): Promise<Error | null> {
  try {
    await op()
  } catch (error) {
    return error as Error
  }
  return null
}

describe.skipIf(!RUN_DB)("build write guard — real database", { timeout: 120_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guarded: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let base: any
  const MARKER = `build_guard_probe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client")
    const { withBuildWriteGuard } = await import("@/lib/build-write-guard")
    base = new PrismaClient({ log: [] })
    guarded = withBuildWriteGuard(base)
    process.env.NEXT_PHASE = "phase-production-build"
  })

  afterAll(async () => {
    delete process.env.NEXT_PHASE
    const leaked = await base.affisellTrackEvent.count({ where: { eventType: MARKER } })
    if (leaked > 0) await base.affisellTrackEvent.deleteMany({ where: { eventType: MARKER } }) // never leave a probe behind
    await base.$disconnect()
    expect(leaked).toBe(0) // nothing was written
  })

  const blocked: Array<[string, () => Promise<unknown>]> = [
    ["model create", () => guarded.user.create({ data: {} })],
    ["model create (a valid row)", () => guarded.affisellTrackEvent.create({ data: { eventType: MARKER } })],
    ["raw execute", () => guarded.$executeRawUnsafe("SELECT 1")],
    [
      "raw INSERT (a valid row)",
      () =>
        guarded.$executeRawUnsafe(
          `INSERT INTO "AffisellTrackEvent" (id, "eventType", "createdAt") VALUES ('${MARKER}', '${MARKER}', now())`,
        ),
    ],
    [
      "raw query that inserts",
      () =>
        guarded.$queryRawUnsafe(
          `INSERT INTO "AffisellTrackEvent" (id, "eventType", "createdAt") VALUES ('${MARKER}_q', '${MARKER}', now()) RETURNING id`,
        ),
    ],
    ["raw query that deletes", () => guarded.$queryRawUnsafe('DELETE FROM "AffisellTrackEvent" WHERE false RETURNING id')],
    ["batch transaction", () => guarded.$transaction([guarded.user.create({ data: {} })])],
    [
      "write INSIDE an interactive transaction",
      () => guarded.$transaction(async (tx: typeof guarded) => tx.affisellTrackEvent.create({ data: { eventType: MARKER } })),
    ],
    ["raw execute INSIDE an interactive transaction", () => guarded.$transaction(async (tx: typeof guarded) => tx.$executeRawUnsafe("SELECT 1"))],
  ]

  it.each(blocked)("refused: %s", async (_label, op) => {
    const error = await failure(op)
    expect(error?.message ?? "").toMatch(guardMessage)
  })

  const allowed: Array<[string, () => Promise<unknown>]> = [
    ["model read", () => guarded.user.findMany({ take: 1, select: { id: true } })],
    ["count", () => guarded.affisellTrackEvent.count()],
    ["raw read", () => guarded.$queryRaw`SELECT 1 AS one`],
    ["raw read (unsafe)", () => guarded.$queryRawUnsafe("SELECT to_regclass('public.\"AffisellTrackEvent\"')::text AS t")],
    ["read INSIDE an interactive transaction", () => guarded.$transaction(async (tx: typeof guarded) => tx.user.findMany({ take: 1, select: { id: true } }))],
  ]

  it.each(allowed)("allowed: %s", async (_label, op) => {
    expect(await failure(op)).toBeNull()
  })

  it("at runtime (not the build phase) the same write is the database's business, not the guard's", async () => {
    delete process.env.NEXT_PHASE
    const error = await failure(() => guarded.user.create({ data: {} })) // invalid on purpose: nothing can be stored
    expect(error).not.toBeNull()
    expect(error!.message).not.toMatch(guardMessage)
    process.env.NEXT_PHASE = "phase-production-build"
  })
})
