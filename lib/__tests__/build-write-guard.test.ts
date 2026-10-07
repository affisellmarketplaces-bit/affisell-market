import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { Prisma, PrismaClient } from "@prisma/client"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  BuildPhaseWriteBlockedError,
  assertBuildWriteAllowed,
  classifyOperation,
  extractRawSql,
  isReadOnlySql,
  withBuildWriteGuard,
} from "@/lib/build-write-guard"
import { isRetryablePrismaConnectionError, prismaErrorMessage } from "@/lib/prisma-connection-error"

import { planVercelBuild } from "../../scripts/vercel-build.mjs"

/**
 * `next build` must never write to a database. These tests pin that, at three levels:
 *   1. the decision (pure): what counts as a read, what as a write;
 *   2. the real Prisma Client extension, against a database that does not exist (so a refused write is provably refused
 *      BEFORE any connection: the error is ours, not a connection error);
 *   3. the wiring: every Prisma client the app creates goes through the guard, and `npm run build` is what Vercel runs.
 */

const BUILD_PHASE = "phase-production-build"
const guardMessage = /\[build-guard\]/

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => {
  delete process.env.NEXT_PHASE
  vi.restoreAllMocks()
})

const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
  void values
  return strings
}

async function failure(op: () => Promise<unknown>): Promise<Error> {
  try {
    await op()
  } catch (error) {
    return error as Error
  }
  throw new Error("expected the operation to fail (no database is reachable in this test)")
}

describe("isReadOnlySql", () => {
  const reads = [
    "SELECT 1",
    "select * from \"User\" where \"createdAt\" > now()",
    'SELECT "updatedAt", "createdAt" FROM "Order"',
    "SELECT 'update' AS word, 'DROP TABLE x' AS text",
    "WITH a AS (SELECT 1 AS n) SELECT * FROM a",
    "SELECT to_regclass('public.\"PulseBattle\"')::text AS to_regclass",
    "-- DROP TABLE x\nSELECT 1",
    "/* INSERT INTO x */ SELECT 1;",
    "SELECT ap.id FROM \"AffiliateProduct\" ap WHERE unaccent(ap.name) % unaccent($1) ORDER BY similarity(ap.name, $1) DESC LIMIT 400",
    "SHOW server_version",
    "EXPLAIN SELECT 1",
    "VALUES (1), (2)",
    "SELECT $$ create table x $$",
  ]
  const writes = [
    "INSERT INTO \"Order\" (id) VALUES (1)",
    "UPDATE \"Order\" SET status = 'x'",
    "DELETE FROM \"Order\"",
    "CREATE TABLE IF NOT EXISTS \"PulseBattle\" (id text)",
    "CREATE INDEX IF NOT EXISTS i ON \"T\"(c)",
    "ALTER TABLE \"PulseBattle\" ADD COLUMN IF NOT EXISTS c text",
    "DROP TABLE \"T\"",
    "TRUNCATE \"T\"",
    "SELECT 1; DROP TABLE \"T\"",
    "SELECT 1; SELECT 2",
    "WITH x AS (DELETE FROM \"T\" RETURNING *) SELECT * FROM x",
    "WITH x AS (INSERT INTO \"T\" VALUES (1) RETURNING *) SELECT * FROM x",
    "SELECT * FROM \"T\" FOR UPDATE",
    "SELECT * FROM \"T\" FOR NO KEY UPDATE",
    "SELECT * INTO \"New\" FROM \"T\"",
    "EXPLAIN ANALYZE SELECT 1",
    "EXPLAIN (ANALYZE, BUFFERS) SELECT 1",
    "DO $$ BEGIN PERFORM 1; END $$",
    "SET search_path TO x",
    "COPY \"T\" FROM stdin",
    "VACUUM",
    "GRANT ALL ON \"T\" TO x",
    "REFRESH MATERIALIZED VIEW v",
    "LOCK TABLE \"T\"",
    "CALL f()",
    "",
    "   ",
    "-- only a comment",
  ]
  it.each(reads)("read: %s", (sql) => expect(isReadOnlySql(sql)).toBe(true))
  it.each(writes)("write or unprovable: %s", (sql) => expect(isReadOnlySql(sql)).toBe(false))
})

describe("extractRawSql — whatever shape the client extension hands over", () => {
  it("string, [string, ...params], tagged template, Prisma.sql", () => {
    expect(extractRawSql("SELECT 1")).toBe("SELECT 1")
    expect(extractRawSql(["SELECT 1", 5])).toBe("SELECT 1")
    expect(extractRawSql(tag`SELECT 1 FROM x WHERE a = ${1}`)).toBe("SELECT 1 FROM x WHERE a =  ? ")
    expect(extractRawSql([tag`DELETE FROM x WHERE a = ${1}`, 1])).toContain("DELETE FROM x")
    expect(extractRawSql(Prisma.sql`SELECT ${1}`)).toContain("SELECT")
    expect(extractRawSql([Prisma.sql`INSERT INTO x VALUES (${1})`])).toContain("INSERT INTO x")
  })

  it("unreadable → null (and therefore refused during the build)", () => {
    for (const bad of [undefined, null, 42, {}, [], [{}]]) expect(extractRawSql(bad), String(bad)).toBeNull()
  })
})

describe("classifyOperation", () => {
  it("known reads pass", () => {
    for (const op of ["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]) {
      expect(classifyOperation(op), op).toEqual({ write: false })
    }
  })

  it("every write, and anything unknown, is refused (fail closed)", () => {
    for (const op of ["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany", "somethingNew", ""]) {
      expect(classifyOperation(op).write, op).toBe(true)
    }
  })

  it("raw: $executeRaw* is always a write; $queryRaw* only when provably read-only", () => {
    expect(classifyOperation("$executeRaw", tag`SELECT 1`).write).toBe(true)
    expect(classifyOperation("$executeRawUnsafe", "SELECT 1").write).toBe(true)
    expect(classifyOperation("$queryRaw", tag`SELECT 1`)).toEqual({ write: false })
    expect(classifyOperation("$queryRawUnsafe", ["SELECT 1"])).toEqual({ write: false })
    expect(classifyOperation("$queryRawUnsafe", ["DELETE FROM x RETURNING id"]).write).toBe(true)
    expect(classifyOperation("$queryRaw", undefined).write).toBe(true)
  })
})

describe("assertBuildWriteAllowed", () => {
  it("does nothing at all outside the production-build phase", () => {
    for (const phase of [undefined, "phase-production-server", "phase-development-server", "phase-export", "phase-test"]) {
      if (phase === undefined) delete process.env.NEXT_PHASE
      else process.env.NEXT_PHASE = phase
      expect(() => assertBuildWriteAllowed("create", {}, "User"), String(phase)).not.toThrow()
      expect(() => assertBuildWriteAllowed("$executeRawUnsafe", ["CREATE TABLE x (id int)"]), String(phase)).not.toThrow()
    }
  })

  it("refuses writes during the build, with an explicit, logged error", () => {
    process.env.NEXT_PHASE = BUILD_PHASE
    let thrown: unknown
    try {
      assertBuildWriteAllowed("create", {}, "AffisellTrackEvent")
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(BuildPhaseWriteBlockedError)
    const error = thrown as BuildPhaseWriteBlockedError
    expect(error.name).toBe("BuildPhaseWriteBlockedError")
    expect(error.operation).toBe("create")
    expect(error.model).toBe("AffisellTrackEvent")
    expect(error.message).toMatch(guardMessage)
    expect(console.error).toHaveBeenCalledWith("[build-guard]", expect.objectContaining({ result: "write_blocked", operation: "create" }))
  })

  it("follows Next's phase ONLY — the same under every Vercel environment, including a local `vercel build` (VERCEL=1)", () => {
    const environments: Array<Record<string, string | undefined>> = [
      {},
      { VERCEL: "1", VERCEL_ENV: "production" },
      { VERCEL: "1", VERCEL_ENV: "preview" },
      { VERCEL: "1", VERCEL_ENV: "development" },
      { VERCEL: "1" },
      { CI: "1" },
    ]
    try {
      for (const vercelEnv of environments) {
        delete process.env.VERCEL
        delete process.env.VERCEL_ENV
        delete process.env.CI
        for (const [key, value] of Object.entries(vercelEnv)) process.env[key] = value
        process.env.NEXT_PHASE = BUILD_PHASE
        const label = JSON.stringify(vercelEnv)
        expect(() => assertBuildWriteAllowed("create", {}, "Order"), label).toThrow(guardMessage)
        expect(() => assertBuildWriteAllowed("$executeRawUnsafe", ["CREATE TABLE x (id int)"]), label).toThrow(guardMessage)
        expect(() => assertBuildWriteAllowed("findMany", {}, "Order"), label).not.toThrow()
        process.env.NEXT_PHASE = "phase-production-server"
        expect(() => assertBuildWriteAllowed("create", {}, "Order"), label).not.toThrow()
      }
    } finally {
      delete process.env.VERCEL
      delete process.env.VERCEL_ENV
      delete process.env.CI
    }
  })

  it("lets reads through during the build", () => {
    process.env.NEXT_PHASE = BUILD_PHASE
    expect(() => assertBuildWriteAllowed("findMany", {}, "Product")).not.toThrow()
    expect(() => assertBuildWriteAllowed("$queryRaw", tag`SELECT 1`)).not.toThrow()
    expect(() => assertBuildWriteAllowed("count", {}, "Order")).not.toThrow()
  })

  it("its error can never be mistaken for a connection problem (no retry loop, no circuit breaker)", () => {
    process.env.NEXT_PHASE = BUILD_PHASE
    let thrown: unknown
    try {
      assertBuildWriteAllowed("update", {}, "Order")
    } catch (error) {
      thrown = error
    }
    expect(isRetryablePrismaConnectionError(thrown)).toBe(false)
    expect(prismaErrorMessage(thrown)).not.toMatch(/can't reach database|connection|timed out/i)
  })
})

describe("the real Prisma Client extension (against a database that does not exist)", () => {
  // Port 9 on localhost: nothing listens. A refused write must fail with OUR error; a read must fail with a CONNECTION
  // error — proving the guard decides before the engine is even asked.
  const UNREACHABLE = "postgresql://nobody:nobody@127.0.0.1:9/none?connect_timeout=2"
  const base = new PrismaClient({ datasources: { db: { url: UNREACHABLE } }, log: [] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guarded = withBuildWriteGuard(base) as any

  afterAll(async () => {
    await base.$disconnect()
  })

  const writes: Array<[string, () => Promise<unknown>]> = [
    ["user.create", () => guarded.user.create({ data: {} })],
    ["order.update", () => guarded.order.update({ where: { id: "x" }, data: {} })],
    ["product.delete", () => guarded.product.delete({ where: { id: "x" } })],
    ["order.deleteMany", () => guarded.order.deleteMany({})],
    ["affisellTrackEvent.createMany", () => guarded.affisellTrackEvent.createMany({ data: [] })],
    ["affiliateProduct.upsert", () => guarded.affiliateProduct.upsert({ where: { id: "x" }, create: {}, update: {} })],
    ["$executeRawUnsafe (DDL)", () => guarded.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "X" (id int)')],
    ["$executeRaw (tagged)", () => guarded.$executeRaw`DELETE FROM "Order"`],
    ["$queryRawUnsafe (DELETE … RETURNING)", () => guarded.$queryRawUnsafe('DELETE FROM "Order" RETURNING id')],
    ["$queryRaw (INSERT … RETURNING)", () => guarded.$queryRaw(Prisma.sql`INSERT INTO "Order"(id) VALUES (1) RETURNING id`)],
    ["$transaction([create])", () => guarded.$transaction([guarded.user.create({ data: {} })])],
    // An INTERACTIVE transaction needs a connection just to open, so it cannot be exercised without a database:
    // see build-write-guard-db.test.ts (real test database).
  ]

  it.each(writes)("during the build, %s is refused by the guard", async (_label, op) => {
    process.env.NEXT_PHASE = BUILD_PHASE
    const error = await failure(op)
    expect(error.message).toMatch(guardMessage)
  }, 30_000)

  const reads: Array<[string, () => Promise<unknown>]> = [
    ["user.findMany", () => guarded.user.findMany()],
    ["order.count", () => guarded.order.count()],
    ["$queryRaw SELECT", () => guarded.$queryRaw`SELECT 1`],
    ["$queryRawUnsafe SELECT", () => guarded.$queryRawUnsafe("SELECT to_regclass('public.\"X\"')::text")],
  ]

  it.each(reads)("during the build, %s is NOT blocked (it reaches the engine and fails only because no database exists)", async (_label, op) => {
    process.env.NEXT_PHASE = BUILD_PHASE
    const error = await failure(op)
    expect(error.message).not.toMatch(guardMessage)
  }, 30_000)

  it.each(writes.slice(0, 4))(
    "under `vercel build` (VERCEL=1, production) the real extension still refuses %s — the guard does not depend on the isolation wrapper",
    async (_label, op) => {
      process.env.VERCEL = "1"
      process.env.VERCEL_ENV = "production"
      process.env.NEXT_PHASE = BUILD_PHASE
      try {
        const error = await failure(op)
        expect(error.message).toMatch(guardMessage)
      } finally {
        delete process.env.VERCEL
        delete process.env.VERCEL_ENV
      }
    },
    30_000
  )

  it("outside the build, a write is not the guard's business", async () => {
    delete process.env.NEXT_PHASE
    const error = await failure(() => guarded.user.create({ data: {} }))
    expect(error.message).not.toMatch(guardMessage)
    process.env.NEXT_PHASE = "phase-production-server"
    const runtime = await failure(() => guarded.$executeRawUnsafe('CREATE TABLE "X" (id int)'))
    expect(runtime.message).not.toMatch(guardMessage)
  }, 30_000)
})

describe("the wiring", () => {
  it("lib/prisma.ts really puts the guard on `prisma` and `fulfillmentPrisma`", async () => {
    // EVERY variable a client may read is pinned to the closed port: `fulfillmentPrisma` prefers DATABASE_URL_UNPOOLED, and
    // importing @prisma/client loads the repository's .env for variables left undefined — which would be production. With
    // all three pinned, this test cannot reach anything but 127.0.0.1:9 even if the guard regressed.
    const unreachable = "postgresql://nobody:nobody@127.0.0.1:9/none?connect_timeout=2"
    const names = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL"] as const
    const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]))
    for (const name of names) process.env[name] = unreachable
    process.env.NEXT_PHASE = BUILD_PHASE
    vi.resetModules()
    const mod = await import("@/lib/prisma")
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = mod.prisma as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = mod.fulfillmentPrisma as any
      expect((await failure(() => p.user.create({ data: {} }))).message).toMatch(guardMessage)
      expect((await failure(() => p.$executeRawUnsafe('CREATE TABLE "X" (id int)'))).message).toMatch(guardMessage)
      expect((await failure(() => f.order.update({ where: { id: "x" }, data: {} }))).message).toMatch(guardMessage)
    } finally {
      await mod.prisma.$disconnect()
      for (const name of names) {
        if (saved[name] === undefined) delete process.env[name]
        else process.env[name] = saved[name]
      }
    }
  }, 60_000)

  const root = process.cwd()
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", "__tests__", ".git", "medusa-backend", "apps", "packages"].includes(entry.name)) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) sourceFiles(path, out)
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(path)
    }
    return out
  }

  it("no application code builds a Prisma client of its own: only the two guarded factories do", () => {
    const creators = ["app", "lib", "components", "hooks", "inngest"]
      .flatMap((dir) => {
        try {
          return sourceFiles(join(root, dir))
        } catch {
          return []
        }
      })
      .filter((file) => /new (Radar)?PrismaClient\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file))
      .sort()
    expect(creators).toEqual(["lib/prisma-radar.ts", "lib/prisma.ts"])
    for (const file of creators) expect(readFileSync(join(root, file), "utf8"), file).toContain("withBuildWriteGuard(")
  })

  it("`npm run build` — what Vercel runs too — goes through the isolation wrapper, never a bare `next build`", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> }
    expect(pkg.scripts.build).toContain("node scripts/build-isolated.mjs")
    expect(pkg.scripts.build).not.toMatch(/(^|&&\s*)next build/)
    // What Vercel runs for the application build is `npm run build`, i.e. the wrapper — never a bare `next build`.
    const plan = planVercelBuild({ VERCEL: "1", VERCEL_ENV: "production" }, { developerMachine: false })
    const applicationBuild = plan.steps.filter((step) => /next build|npm run build/.test(step.command))
    expect(applicationBuild.map((step) => step.command)).toEqual(["npm run build"])
  })
})
