import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { withBuildWriteGuard } from "@/lib/build-write-guard"
import {
  ALLOW_PRODUCTION_WRITES_VARIABLE,
  DEVELOPER_ENV_FILES,
  DeveloperProductionWriteBlockedError,
  assertDeveloperProductionWriteAllowed,
  isDeveloperMachine,
  productionEndpointOf,
  resetDeveloperMachineCache,
} from "@/lib/developer-production-guard"

import { DEVELOPER_ENV_FILES as SCRIPT_DEVELOPER_ENV_FILES } from "../../scripts/build-isolated.mjs"
import { applyStagingDevEnv as applyStagingDevEnvScripts } from "../../lib/env.pure.mjs"
import { applyStagingDevEnv as applyStagingDevEnvTs } from "@/lib/env"
import { assessProductionByAccident } from "../../scripts/lib/production-guard.mjs"

/**
 * Application-level twin of scripts/lib/production-guard.mjs: the Prisma clients of `lib/prisma.ts` refuse WRITES to the production
 * database from a developer machine (`npm run dev`, any script importing `@/lib/prisma`, a worker), unless the endpoint was confirmed.
 * Reads pass. Nothing here can reach a database: strings, and a production-LOOKING host that cannot resolve (`.invalid`).
 */

const PROD = "postgresql://user:s3cr3t-pw@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require"
const PROD_DIRECT = "postgresql://user:s3cr3t-pw@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb"
const STAGING = "postgresql://user:s3cr3t-pw@ep-shy-wind-aly4bmc7-pooler.c-3.eu-central-1.aws.neon.tech/neondb"
const LOCAL = "postgresql://affisell:affisell@localhost:5433/affisell"
const PROD_LOOKING = "postgresql://nobody:nobody@ep-misty-sea-fake000.invalid:5432/none?connect_timeout=2"

const guardMessage = /\[dev-guard\]/
const dirs: string[] = []
// The guard logs every refusal (`[dev-guard] write_blocked`, endpoint masked). Silenced here so a test run does not print the production
// endpoint name 19 times; the log itself is asserted below.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  resetDeveloperMachineCache()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function tempDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "dev-guard-"))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe("productionEndpointOf", () => {
  it.each([
    [PROD, "ep-misty-sea-al1ne07p"],
    [PROD_DIRECT, "ep-misty-sea-al1ne07p"],
    [PROD_LOOKING, "ep-misty-sea-fake000"],
    [STAGING, null],
    [LOCAL, null],
    ["postgresql://u:p@127.0.0.1:5432/db", null],
    ["", null],
    [undefined, null],
    ["not a url", null],
  ])("%s → %s", (url, expected) => {
    expect(productionEndpointOf(url as string | undefined)).toBe(expected)
  })
})

describe("developer machine detection", () => {
  it("a secret env file in the working directory = developer machine; example files and a bare checkout do not count", () => {
    for (const name of DEVELOPER_ENV_FILES) expect(isDeveloperMachine(tempDir({ [name]: "X=1" })), name).toBe(true)
    expect(isDeveloperMachine(tempDir({ ".env.example": "X=1", ".env.local.example": "X=1" }))).toBe(false)
    expect(isDeveloperMachine(tempDir())).toBe(false)
  })

  it("the list is the same as the one the build wrapper uses (the two copies cannot drift)", () => {
    expect([...DEVELOPER_ENV_FILES]).toEqual(SCRIPT_DEVELOPER_ENV_FILES)
  })

  it("the default answer is computed once from the working directory", () => {
    const withFile = tempDir({ ".env.local": "X=1" })
    const spy = vi.spyOn(process, "cwd").mockReturnValue(withFile)
    resetDeveloperMachineCache()
    expect(isDeveloperMachine()).toBe(true)
    spy.mockReturnValue(tempDir())
    expect(isDeveloperMachine()).toBe(true) // cached: the files do not appear or vanish mid-run
    resetDeveloperMachineCache()
    expect(isDeveloperMachine()).toBe(false)
  })
})

describe("assertDeveloperProductionWriteAllowed", () => {
  const dev = (over: Partial<Parameters<typeof assertDeveloperProductionWriteAllowed>[0]> = {}) =>
    assertDeveloperProductionWriteAllowed({ operation: "create", model: "Order", write: true, databaseUrl: PROD, developerMachine: true, env: {}, ...over })

  it("a WRITE to production from a developer machine throws, naming the endpoint and how to confirm — never the password", () => {
    expect(() => dev()).toThrow(DeveloperProductionWriteBlockedError)
    let message = ""
    try {
      dev()
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(guardMessage)
    expect(console.error).toHaveBeenCalledWith("[dev-guard]", expect.objectContaining({ result: "write_blocked", endpoint: "ep-misty-sea-al1ne07p-****" }))
    expect(message).toContain("ep-misty-sea-al1ne07p-****")
    expect(message).toContain(`${ALLOW_PRODUCTION_WRITES_VARIABLE}=ep-misty-sea-al1ne07p`)
    expect(message).not.toMatch(/s3cr3t/)
  })

  it("reads, other databases, and real hosts are untouched", () => {
    expect(() => dev({ write: false })).not.toThrow()
    expect(() => dev({ databaseUrl: STAGING })).not.toThrow()
    expect(() => dev({ databaseUrl: LOCAL })).not.toThrow()
    expect(() => dev({ databaseUrl: undefined })).not.toThrow()
    expect(() => dev({ developerMachine: false })).not.toThrow() // Vercel / Railway / CI: no secret env file
  })

  it("the confirmation must NAME the endpoint (pooler spelling and lists are fine)", () => {
    for (const value of ["ep-misty-sea-al1ne07p", "EP-MISTY-SEA-AL1NE07P-pooler", "ep-x, ep-misty-sea-al1ne07p"]) {
      expect(() => dev({ env: { [ALLOW_PRODUCTION_WRITES_VARIABLE]: value } }), value).not.toThrow()
    }
    for (const value of ["1", "true", "ep-shy-wind-aly4bmc7", ""]) {
      expect(() => dev({ env: { [ALLOW_PRODUCTION_WRITES_VARIABLE]: value } }), value).toThrow(DeveloperProductionWriteBlockedError)
    }
  })

  it("agrees with the script-side guard on every case (the two implementations cannot drift)", () => {
    const urls = [PROD, PROD_DIRECT, STAGING, LOCAL, PROD_LOOKING, ""]
    const confirmations = ["", "ep-misty-sea-al1ne07p", "1"]
    for (const url of urls) {
      for (const confirm of confirmations) {
        for (const developerMachine of [true, false]) {
          const env = { DATABASE_URL: url, [ALLOW_PRODUCTION_WRITES_VARIABLE]: confirm }
          const scripts = assessProductionByAccident({ tool: "t", env, developerMachine }).ok
          let lib = true
          try {
            assertDeveloperProductionWriteAllowed({ operation: "create", write: true, databaseUrl: url, developerMachine, env })
          } catch {
            lib = false
          }
          expect(lib, `${url.slice(0, 40)} confirm=${confirm} dev=${developerMachine}`).toBe(scripts)
        }
      }
    }
  })
})

describe("the REAL Prisma extension: a refused write never reaches the engine, a read does", () => {
  // A real client for a production-LOOKING database that cannot exist: an operation that passes the guard fails with a CONNECTION
  // error; one the guard refuses fails with OUR error — proving the decision is taken before any connection.
  const base = new PrismaClient({ datasources: { db: { url: PROD_LOOKING } }, log: [] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guarded: any
  beforeAll(() => {
    guarded = withBuildWriteGuard(base, { databaseUrl: PROD_LOOKING })
  })
  afterAll(async () => {
    await base.$disconnect()
  })

  async function outcome(op: () => Promise<unknown>): Promise<string> {
    try {
      await op()
      return "ok"
    } catch (error) {
      return guardMessage.test((error as Error).message) ? "GUARD" : "passed the guard (then failed to connect, as it should)"
    }
  }
  const asDeveloperMachine = () => {
    vi.spyOn(process, "cwd").mockReturnValue(tempDir({ ".env.local": "X=1" }))
    resetDeveloperMachineCache()
  }
  const asRealHost = () => {
    vi.spyOn(process, "cwd").mockReturnValue(tempDir())
    resetDeveloperMachineCache()
  }

  const writes: Array<[string, () => Promise<unknown>]> = [
    ["order.create", () => guarded.order.create({ data: {} })],
    ["product.deleteMany", () => guarded.product.deleteMany({})],
    ["user.update", () => guarded.user.update({ where: { id: "x" }, data: {} })],
    ["platformOAuthCredential.upsert (the AliExpress incident)", () => guarded.platformOAuthCredential.upsert({ where: { provider: "aliexpress" }, create: {}, update: {} })],
    ["$executeRawUnsafe (DDL)", () => guarded.$executeRawUnsafe('CREATE TABLE "X" (id int)')],
    ["$queryRawUnsafe (DELETE … RETURNING)", () => guarded.$queryRawUnsafe('DELETE FROM "Order" RETURNING id')],
  ]
  const reads: Array<[string, () => Promise<unknown>]> = [
    ["user.findMany", () => guarded.user.findMany()],
    ["order.count", () => guarded.order.count()],
    ["$queryRaw SELECT", () => guarded.$queryRaw`SELECT 1`],
  ]

  it.each(writes)("developer machine: %s is REFUSED by the guard", async (_label, op) => {
    asDeveloperMachine()
    expect(await outcome(op)).toBe("GUARD")
  }, 30_000)

  it.each(reads)("developer machine: %s is NOT refused (read-only use of production from the local UI stays possible)", async (_label, op) => {
    asDeveloperMachine()
    expect(await outcome(op)).not.toBe("GUARD")
  }, 30_000)

  it("developer machine, endpoint confirmed on purpose: the write passes the guard", async () => {
    asDeveloperMachine()
    vi.stubEnv(ALLOW_PRODUCTION_WRITES_VARIABLE, "ep-misty-sea-fake000")
    expect(await outcome(() => guarded.order.create({ data: {} }))).not.toBe("GUARD")
  }, 30_000)

  it("real host (no secret env file): the write passes the guard — production behaviour is unchanged", async () => {
    asRealHost()
    expect(await outcome(() => guarded.order.create({ data: {} }))).not.toBe("GUARD")
  }, 30_000)

  it("a client created WITHOUT a database url (tests, the build wrapper's empty env) has nothing to protect and stays out of the way", async () => {
    const unguarded = withBuildWriteGuard(new PrismaClient({ datasources: { db: { url: LOCAL } }, log: [] }), {}) as never as { order: { create: (a: unknown) => Promise<unknown> }; $disconnect: () => Promise<void> }
    asDeveloperMachine()
    expect(await outcome(() => unguarded.order.create({ data: {} }))).not.toBe("GUARD")
    await unguarded.$disconnect()
  }, 30_000)
})

describe("wiring", () => {
  it("both factories hand the guard the URL their client really uses — the fulfillment client uses its OWN (direct) URL", () => {
    const prisma = readFileSync("lib/prisma.ts", "utf8")
    expect(prisma).toMatch(/withBuildWriteGuard\(extended, \{ databaseUrl \}\)/)
    expect(prisma).toMatch(/createPrismaClient\(createDefaultBasePrismaClient, url\)/)
    expect(prisma).toMatch(/createPrismaClient\(\(\) => createBasePrismaClient\(directUrl, "fulfillment"\), directUrl\)/)
    expect(readFileSync("lib/prisma-radar.ts", "utf8")).toMatch(/\{ databaseUrl: url \}/)
  })
})

describe("`npm run dev:staging` really points EVERYTHING at staging (it used to re-point only DATABASE_URL)", () => {
  const KEYS = ["DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED", "AFFISELL_DEV_STAGING"] as const
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  for (const [label, apply] of [["lib/env.pure.mjs (what the script runs)", applyStagingDevEnvScripts], ["lib/env.ts (its TypeScript mirror)", applyStagingDevEnvTs]] as const) {
    it(`${label}: a .env.local that says production for all three variables ends up on staging for all three`, () => {
      process.env.DATABASE_URL = PROD
      process.env.DIRECT_URL = PROD_DIRECT
      process.env.DATABASE_URL_UNPOOLED = PROD_DIRECT
      apply(STAGING)
      for (const key of ["DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED"] as const) {
        expect(productionEndpointOf(process.env[key]), key).toBeNull()
        expect(process.env[key], key).toContain("ep-shy-wind-aly4bmc7")
      }
      expect(process.env.DIRECT_URL).not.toContain("-pooler")
      expect(process.env.DATABASE_URL_UNPOOLED).not.toContain("pgbouncer")
      expect(process.env.AFFISELL_DEV_STAGING).toBe("1")
      // …so nothing is left for either guard to refuse.
      expect(assessProductionByAccident({ tool: "dev:staging", env: process.env as Record<string, string>, developerMachine: true }).ok).toBe(true)
    })
  }
})
