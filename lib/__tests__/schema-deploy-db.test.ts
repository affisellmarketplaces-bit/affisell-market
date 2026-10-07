/**
 * `npm run schema:migrate` / `schema:verify` against a REAL database — the test database only (staging branch, see
 * lib/testing/db-test-guard.ts: it refuses any URL that shares an endpoint with the repository's default database).
 *   RUN_DB_TESTS=1 npx vitest run lib/__tests__/schema-deploy-db.test.ts
 *
 * The test database already holds every migration, so `migrate` has nothing to deploy: it reads the migration state, takes
 * Prisma's lock, and checks the catalog. Nothing is written. The URL is handed to the child process EXPLICITLY (its environment
 * is otherwise empty), and the script reads no .env file.
 */
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { beforeAll, describe, expect, it } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const RUN_DB = dbTestsRequested()

const SCHEMA_DEPLOY = resolve("scripts/schema-deploy.mjs")

function run(command: string, args: string[], url: string) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: url } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 240_000,
  })
}

describe.skipIf(!RUN_DB)("schema deploy — real test database", { timeout: 300_000 }, () => {
  let url = ""
  let endpoint = ""

  beforeAll(() => {
    endpoint = pointAtTestDatabase().split("@")[0]! // throws (and so fails the suite) unless this is the dedicated test database
    url = process.env.DATABASE_URL!
    expect(endpoint).not.toMatch(/misty-sea/)
  })

  it("TEST 1 (real) — `schema:migrate` on a migrated database: exit 0, the migration state is read, the catalog is verified", () => {
    const result = run(process.execPath, [SCHEMA_DEPLOY, "migrate", "--expect-endpoint", endpoint], url)
    expect(result.stdout + result.stderr).toMatch(/no pending migration/)
    expect(result.stdout).toMatch(/Event-spine schema: PRESENT/)
    expect(result.stdout).toMatch(/migrated and verified/)
    expect(result.status).toBe(0)
  })

  it("`schema:verify` on the same database: exit 0", () => {
    const result = run(process.execPath, [SCHEMA_DEPLOY, "verify"], url)
    expect(result.stdout).toMatch(/verified:/)
    expect(result.status).toBe(0)
  })

  it("TEST 3 (real) — a catalog verification that fails exits non-zero (the spine is PRESENT here, so `--expect absent` must fail)", () => {
    const result = run("npx", ["tsx", "scripts/verify-event-spine.ts", "--expect", "absent"], url)
    expect(result.stdout).toMatch(/expected "absent" but found "present"/)
    expect(result.status).toBe(1)
  })

  it("`schema:migrate` without --expect-endpoint is refused before anything is run, even on the test database", () => {
    const result = run(process.execPath, [SCHEMA_DEPLOY, "migrate"], url)
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/--expect-endpoint/)
  })

  it("the read-only session is enforced by PostgreSQL itself: DDL / DML are refused (25006) even with `WHERE false`, SELECT works", async () => {
    const { PrismaClient } = await import("@prisma/client")
    const { withReadOnlySession } = await import("../../scripts/prisma-explicit-db.mjs")
    const prisma = new PrismaClient({ datasources: { db: { url: withReadOnlySession(url) } }, log: [] })
    try {
      const refused = async (sql: string) => {
        try {
          await prisma.$executeRawUnsafe(sql)
          return "EXECUTED"
        } catch (error) {
          return /25006|read-only transaction/i.test(String((error as Error).message)) ? "refused" : `other: ${(error as Error).message}`
        }
      }
      expect(await refused("CREATE TEMP TABLE ro_probe (i int)")).toBe("refused")
      expect(await refused('DELETE FROM "AffisellTrackEvent" WHERE false')).toBe("refused")
      expect(await refused('UPDATE "AffisellTrackEvent" SET "source" = "source" WHERE false')).toBe("refused")
      expect(await refused('INSERT INTO "_prisma_migrations" (id) SELECT \'x\' WHERE false')).toBe("refused")
      const rows = (await prisma.$queryRawUnsafe('SELECT count(*)::int AS n FROM "_prisma_migrations"')) as Array<{ n: number }>
      expect(rows[0]!.n).toBeGreaterThan(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  it("treated as a Vercel PRODUCTION deployment, the staging database is refused (the wrong database must not pass verification)", () => {
    const result = spawnSync(process.execPath, [SCHEMA_DEPLOY, "verify"], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL: url } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      timeout: 60_000,
    })
    // On a developer machine the refusal is "developer machine"; on a clean checkout it is "staging database". Either way: exit 2.
    expect(result.status).toBe(2)
  })
})
