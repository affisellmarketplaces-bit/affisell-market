import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ALLOW_PRODUCTION_WRITES_VARIABLE,
  DATABASE_URL_VARIABLES,
  assessProductionByAccident,
  parseConfirmation,
} from "../../scripts/lib/production-guard.mjs"

/**
 * "Production by accident": a tool launched from a developer machine whose .env holds the PRODUCTION database URL must not write to
 * it unless the endpoint was named. This is how a test wrote fake AliExpress tokens into production, and how `prisma/clear-products.ts`
 * (deleteMany on every order and product) could have run. None of these tests can reach a database: the "production" URLs below are
 * strings, or use a host that cannot resolve (`.invalid`).
 */

const PROD = "postgresql://user:s3cr3t-pw@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const PROD_DIRECT = "postgresql://user:s3cr3t-pw@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const STAGING = "postgresql://user:s3cr3t-pw@ep-shy-wind-aly4bmc7-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const LOCAL = "postgresql://affisell:affisell@localhost:5433/affisell"
/** Looks like production to the classifier, can never resolve. */
const PROD_LOOKING = "postgresql://user:s3cr3t-pw@ep-misty-sea-fake000.invalid/neondb"

const dirs: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function tempDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "production-guard-"))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

const assess = (env: Record<string, string>, over: Partial<Parameters<typeof assessProductionByAccident>[0]> = {}) =>
  assessProductionByAccident({ tool: "the-tool", env, developerMachine: true, ...over })

describe("assessProductionByAccident", () => {
  it("developer machine + a production URL + no confirmation = REFUSED, and the reason says how to confirm without echoing a password", () => {
    const verdict = assess({ DATABASE_URL: PROD })
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.reason).toMatch(/the-tool writes, and this machine's environment points it at PRODUCTION/)
    expect(verdict.reason).toContain(`${ALLOW_PRODUCTION_WRITES_VARIABLE}=ep-misty-sea-al1ne07p`)
    expect(verdict.reason).not.toMatch(/s3cr3t/)
    expect(verdict.exposures).toEqual([expect.objectContaining({ variable: "DATABASE_URL", endpoint: "ep-misty-sea-al1ne07p" })])
  })

  it("ANY of the URLs Prisma may use counts: a staging DATABASE_URL with a production DIRECT_URL is still production (the dev:staging trap)", () => {
    const verdict = assess({ DATABASE_URL: STAGING, DIRECT_URL: PROD_DIRECT })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.exposures.map((e) => e.variable)).toEqual(["DIRECT_URL"])
    expect(assess({ DATABASE_URL: STAGING, DATABASE_URL_UNPOOLED: PROD_DIRECT }).ok).toBe(false)
    expect(DATABASE_URL_VARIABLES).toEqual(expect.arrayContaining(["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL", "RADAR_DATABASE_URL"]))
  })

  it("staging, a local database, nothing set, a non-postgres value: all fine", () => {
    const environments: Array<Record<string, string>> = [{ DATABASE_URL: STAGING }, { DATABASE_URL: LOCAL }, {}, { DATABASE_URL: "mysql://u:p@h/db" }, { DATABASE_URL: "" }]
    for (const env of environments) {
      expect(assess(env).ok, JSON.stringify(env)).toBe(true)
    }
  })

  it("INERT on a real host (no secret env file): Vercel, Railway and CI are never affected", () => {
    expect(assess({ DATABASE_URL: PROD }, { developerMachine: false })).toMatchObject({ ok: true, active: false })
  })

  it("explicit confirmation names the endpoint — pooled spelling, a list, extra spaces are fine; a bare `1`, `true` or another endpoint is not", () => {
    const base = { DATABASE_URL: PROD, DIRECT_URL: PROD_DIRECT }
    for (const value of ["ep-misty-sea-al1ne07p", "EP-Misty-Sea-al1ne07p-pooler", "ep-other, ep-misty-sea-al1ne07p", " ep-misty-sea-al1ne07p "]) {
      expect(assess({ ...base, [ALLOW_PRODUCTION_WRITES_VARIABLE]: value }), value).toMatchObject({ ok: true, active: true })
    }
    for (const value of ["1", "true", "yes", "production", "ep-shy-wind-aly4bmc7", ""]) {
      expect(assess({ ...base, [ALLOW_PRODUCTION_WRITES_VARIABLE]: value }).ok, value).toBe(false)
    }
    expect([...parseConfirmation("ep-a-pooler, ep-b  redis")]).toEqual(["ep-a", "ep-b", "redis"])
  })

  it("`urlVariables` lets a tool say which variables are its databases (db:copy: DATABASE_URL is the source, PROD_DB the destination)", () => {
    const env = { DATABASE_URL: LOCAL, PROD_DB: PROD }
    expect(assess(env).ok).toBe(true) // PROD_DB is not a default variable...
    const verdict = assess(env, { urlVariables: ["DATABASE_URL", "PROD_DB"] }) // ...so the tool that uses it names it
    expect(verdict.ok).toBe(false)
    expect(assess({ ...env, [ALLOW_PRODUCTION_WRITES_VARIABLE]: "ep-misty-sea-al1ne07p" }, { urlVariables: ["DATABASE_URL", "PROD_DB"] }).ok).toBe(true)
  })

  it("redis: a remote Redis (REDIS_URL / UPSTASH) is the shared production queue; localhost is not", () => {
    expect(assess({ REDIS_URL: "rediss://default:tok@nice-x.upstash.io:6379" }, { redis: true }).ok).toBe(false)
    expect(assess({ UPSTASH_REDIS_REST_URL: "https://nice-x.upstash.io" }, { redis: true }).ok).toBe(false)
    expect(assess({ REDIS_URL: "redis://localhost:6379" }, { redis: true }).ok).toBe(true)
    expect(assess({ REDIS_URL: "redis://127.0.0.1:6379" }, { redis: true }).ok).toBe(true)
    expect(assess({ REDIS_URL: "rediss://default:tok@nice-x.upstash.io:6379", [ALLOW_PRODUCTION_WRITES_VARIABLE]: "redis" }, { redis: true }).ok).toBe(true)
    expect(assess({ REDIS_URL: "rediss://default:tok@nice-x.upstash.io:6379" }, { redis: false }).ok).toBe(true) // only tools that use Redis ask
  })
})

describe("the real helper, in a real process (exit code 2 / continues)", () => {
  const HELPER = pathToFileURL(resolve("scripts/lib/production-guard.mjs")).href
  function runTool(env: Record<string, string>, root: string) {
    const dir = tempDir({
      "tool.mjs": `import { assertNotProductionByAccident } from ${JSON.stringify(HELPER)}\nassertNotProductionByAccident("the-tool", { root: ${JSON.stringify(root)} })\nconsole.log("RAN")\n`,
    })
    return spawnSync(process.execPath, [join(dir, "tool.mjs")], {
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      timeout: 60_000,
    })
  }

  it("on a developer machine against production: exit 2, nothing after the guard runs", () => {
    const result = runTool({ DATABASE_URL: PROD_LOOKING }, tempDir({ ".env.local": "X=1" }))
    expect(result.status).toBe(2)
    expect(result.stdout).not.toContain("RAN")
    expect(result.stderr).toMatch(/REFUSED/)
    expect(result.stderr).not.toMatch(/s3cr3t/)
  })

  it("with the endpoint confirmed it continues; on a real host (no env file) it is inert", () => {
    expect(runTool({ DATABASE_URL: PROD_LOOKING, [ALLOW_PRODUCTION_WRITES_VARIABLE]: "ep-misty-sea-fake000" }, tempDir({ ".env.local": "X=1" })).stdout).toContain("RAN")
    expect(runTool({ DATABASE_URL: PROD_LOOKING }, tempDir()).stdout).toContain("RAN")
  })
})

describe("INVARIANT — every standalone tool that creates its own Prisma client is guarded, or is a verified read-only tool", () => {
  const root = process.cwd()
  /**
   * Tools verified READ-ONLY by reading them (find/count/groupBy/raw SELECT only, or an explicit READ-ONLY contract), or that choose
   * their own target explicitly and read-only (verify-event-spine, unlock-migrations) or use the dedicated test database (check-test-db).
   * A new script is NOT on this list: it must call assertNotProductionByAccident(), or someone must read it and add it here.
   */
  const READ_ONLY_TOOLS = [
    "scripts/audit-money-splits.mjs",
    "scripts/audit-taxonomy-gaps.ts",
    "scripts/boutique-list-listings.mjs",
    "scripts/check-categories.ts",
    "scripts/check-discovery-health.ts",
    "scripts/check-ebay-categories.mjs",
    "scripts/check-test-db.ts",
    "scripts/eval-photo-only.ts",
    "scripts/eval-taxonomy-classifier.ts",
    "scripts/report-listing-readiness.ts",
    "scripts/show-affisell-commission-grid.ts",
    "scripts/test-category-attribute-validation.ts",
    "scripts/unlock-migrations.ts",
    "scripts/verify-category-suggestions.ts",
    "scripts/verify-event-spine.ts",
  ]

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "__tests__") continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) sourceFiles(path, out)
      else if (/\.(ts|mjs|js|cjs)$/.test(entry)) out.push(path)
    }
    return out
  }
  const creators = ["prisma", "scripts", "workers"]
    .flatMap((dir) => sourceFiles(join(root, dir)))
    .filter((file) => /new (Radar)?PrismaClient\(/.test(readFileSync(file, "utf8")))
    .map((file) => relative(root, file))
    .sort()

  it("there are standalone clients to protect (the scan finds them)", () => {
    expect(creators.length).toBeGreaterThan(50)
  })

  it("each one calls the guard BEFORE it creates the client, and after it has loaded its env files", () => {
    const unguarded: string[] = []
    for (const file of creators.filter((f) => !READ_ONLY_TOOLS.includes(f))) {
      const text = readFileSync(join(root, file), "utf8")
      const call = text.search(/^\s*(if \([^)]*\) )?assertNotProductionByAccident\(/m)
      const client = text.search(/new (Radar)?PrismaClient\(/)
      const envLoad = text.search(/\b(config|loadEnv)\(\s*\{/)
      const imported = /from ["'](\.\/|\.\.\/scripts\/)lib\/production-guard\.mjs["']/.test(text)
      if (!imported || call < 0 || call > client || (envLoad >= 0 && call < envLoad)) unguarded.push(file)
    }
    expect(unguarded).toEqual([])
  })

  it("the read-only list does not rot: each entry exists, creates a client, and still contains no direct write", () => {
    for (const file of READ_ONLY_TOOLS) {
      expect(creators, file).toContain(file)
      const text = readFileSync(join(root, file), "utf8")
      expect(text, file).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/)
    }
  })

  it("db:copy names its two databases; the auto-order worker asks for Redis too", () => {
    expect(readFileSync(join(root, "scripts/copy-to-prod.ts"), "utf8")).toMatch(/urlVariables: \["DATABASE_URL", "PROD_DB"\]/)
    expect(readFileSync(join(root, "workers/auto-order-worker.ts"), "utf8")).toMatch(/assertNotProductionByAccident\("workers\/auto-order-worker\.ts", \{ redis: true \}\)/)
  })

  it("the guarded `--apply` / `direct` tools only guard the branch that writes", () => {
    expect(readFileSync(join(root, "scripts/repair-order-totals.mjs"), "utf8")).toMatch(/if \(apply\) assertNotProductionByAccident/)
    expect(readFileSync(join(root, "scripts/import-leads-to-crm.mjs"), "utf8")).toMatch(/if \(direct\) assertNotProductionByAccident/)
  })
})

describe("the Prisma CLI config refuses the commands that change a database when this machine's env says production", () => {
  const originalCwd = process.cwd
  const originalArgv = process.argv
  let envBefore: NodeJS.ProcessEnv
  afterEach(() => {
    process.cwd = originalCwd
    process.argv = originalArgv
    for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key]
    Object.assign(process.env, envBefore)
  })

  /** Loads prisma.config.ts the way the CLI does: a command line, a working directory holding the env files. */
  async function loadConfig(command: string[], files: Record<string, string>, env: Record<string, string> = {}) {
    envBefore = { ...process.env }
    const dir = tempDir(files)
    process.cwd = () => dir
    process.argv = ["node", "prisma", ...command]
    Object.assign(process.env, env)
    vi.resetModules()
    return import("../../prisma.config")
  }
  const prodFile = { ".env.local": `DATABASE_URL=${PROD_LOOKING}\n` }

  it.each([["db", "push"], ["migrate", "deploy"], ["migrate", "dev"], ["migrate", "reset"], ["migrate", "resolve"], ["db", "execute"], ["db", "seed"]])(
    "`prisma %s %s` against a production env file is REFUSED while the config loads — before any connection",
    async (...command) => {
      await expect(loadConfig(command, prodFile)).rejects.toThrow(/writes, and this machine's environment points it at PRODUCTION/)
    }
  )

  it("the commands that do not change a database still load (generate is what every build and install runs)", async () => {
    for (const command of [["generate"], ["validate"], ["format"], ["migrate", "status"], ["db", "pull"], ["migrate", "diff"]]) {
      const loaded = await loadConfig(command, prodFile)
      expect(loaded.default, command.join(" ")).toBeTruthy()
    }
  })

  it("confirmed on purpose, a write command loads; a staging env file never needed confirmation", async () => {
    expect((await loadConfig(["migrate", "deploy"], prodFile, { [ALLOW_PRODUCTION_WRITES_VARIABLE]: "ep-misty-sea-fake000" })).default).toBeTruthy()
    const stagingFile = { ".env.local": `DATABASE_URL=${STAGING}\n` }
    expect((await loadConfig(["db", "push"], stagingFile)).default).toBeTruthy()
  })

  it("on a real host (no env file in the working directory) it is inert, whatever the variables say", async () => {
    expect((await loadConfig(["migrate", "deploy"], {}, { DATABASE_URL: PROD_LOOKING })).default).toBeTruthy()
  })
})
