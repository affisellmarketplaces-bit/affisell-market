import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  EXIT,
  PRISMA_MIGRATION_LOCK_KEY,
  assessSchemaTarget,
  classifyAdvisoryLocks,
  classifyDatabaseUrl,
  detectDeployContext,
  parseCli,
  runSchemaDeploy,
} from "../../scripts/schema-deploy.mjs"

/**
 * SCHEMA DEPLOY → SCHEMA VERIFY. A failed migration must stop the pipeline (exit != 0, nothing after it runs); nothing may turn
 * a failed migration into an applied one; a Preview must never reach production; and the application's own advisory locks must
 * never be killed. None of this needs a database: Prisma and the catalog check are injected. The few real-process tests use a
 * host that cannot exist (`.invalid`) or a closed local port — never a real database.
 */

// Strings only: nothing here ever connects (the policy refuses, or the subprocess is pointed at an unresolvable host).
const PROD = "postgresql://user:s3cr3t-pw@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
const PROD_DIRECT = "postgresql://user:s3cr3t-pw@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const STAGING = "postgresql://user:s3cr3t-pw@ep-shy-wind-aly4bmc7-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
const STAGING_DIRECT = "postgresql://user:s3cr3t-pw@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const OTHER_HOST = "postgresql://user:s3cr3t-pw@db.example-provider.com:5432/app"
/** Looks like production to the classifier (host contains "misty-sea") but can never resolve. */
const PROD_LOOKING_UNREACHABLE = "postgresql://user:s3cr3t-pw@ep-misty-sea-fake000.invalid/neondb"

const VERCEL_PROD = { VERCEL: "1", VERCEL_ENV: "production" }
const VERCEL_PREVIEW = { VERCEL: "1", VERCEL_ENV: "preview" }

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function tempDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "schema-deploy-"))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe("detectDeployContext", () => {
  it.each([
    [{}, "local"],
    [{ VERCEL_ENV: "production" }, "local"], // VERCEL_ENV alone is not Vercel
    [VERCEL_PROD, "vercel-production"],
    [{ VERCEL: "1", VERCEL_ENV: " Production " }, "vercel-production"],
    [VERCEL_PREVIEW, "vercel-preview"],
    [{ VERCEL: "1", VERCEL_ENV: "development" }, "vercel-preview"],
    [{ VERCEL: "1" }, "vercel-unknown"],
    [{ VERCEL: "1", VERCEL_ENV: "staging" }, "vercel-unknown"],
  ])("%j → %s", (env, kind) => {
    expect(detectDeployContext(env as Record<string, string>).kind).toBe(kind)
  })
})

describe("classifyDatabaseUrl", () => {
  it("Neon branches by endpoint; pooled and direct are the same endpoint", () => {
    expect(classifyDatabaseUrl(PROD)).toMatchObject({ endpoint: "ep-misty-sea-al1ne07p", branch: "production" })
    expect(classifyDatabaseUrl(PROD_DIRECT)).toMatchObject({ endpoint: "ep-misty-sea-al1ne07p", branch: "production" })
    expect(classifyDatabaseUrl(STAGING)).toMatchObject({ endpoint: "ep-shy-wind-aly4bmc7", branch: "staging" })
  })

  it("a host that is neither localhost nor a known Neon branch is UNKNOWN — never 'local' (env-shared.mjs would say local)", () => {
    expect(classifyDatabaseUrl(OTHER_HOST)).toMatchObject({ branch: "unknown", endpoint: "db.example-provider.com" })
    expect(classifyDatabaseUrl("postgresql://u:p@127.0.0.1:5433/db")).toMatchObject({ branch: "local", endpoint: "127.0.0.1" })
    expect(classifyDatabaseUrl("postgresql://u:p@localhost/db").branch).toBe("local")
  })
})

describe("assessSchemaTarget — which database may this run touch?", () => {
  const assess = (over: Partial<Parameters<typeof assessSchemaTarget>[0]> & { env: Record<string, string | undefined> }) =>
    assessSchemaTarget({
      // A Vercel build only ever VERIFIES; `migrate` is local-only (see "no migration in a Vercel build" below).
      command: detectDeployContext(over.env).kind === "local" ? "migrate" : "verify",
      context: detectDeployContext(over.env),
      developerMachine: false,
      ...over,
    })

  describe("Vercel Production", () => {
    it("the production database is the expected target", () => {
      const verdict = assess({ env: { ...VERCEL_PROD, DATABASE_URL: PROD, DIRECT_URL: PROD_DIRECT, DATABASE_URL_UNPOOLED: PROD_DIRECT } })
      expect(verdict).toMatchObject({ action: "run", target: { endpoint: "ep-misty-sea-al1ne07p", branch: "production" } })
    })

    it("refuses a staging or local database: it would migrate the wrong one and `verify` would then pass on it", () => {
      for (const url of [STAGING, "postgresql://u:p@127.0.0.1:5432/db"]) {
        const verdict = assess({ env: { ...VERCEL_PROD, DATABASE_URL: url } })
        expect(verdict.action).toBe("refuse")
      }
    })

    it("a production build without a database is refused, not skipped", () => {
      const verdict = assess({ env: { ...VERCEL_PROD } })
      expect(verdict).toMatchObject({ action: "refuse" })
      expect((verdict as { reason: string }).reason).toMatch(/production build without DATABASE_URL/)
    })

    it("an unrecognised host is allowed (it is the one the app uses) but warned about", () => {
      const verdict = assess({ env: { ...VERCEL_PROD, DATABASE_URL: OTHER_HOST } })
      expect(verdict).toMatchObject({ action: "run", target: { branch: "unknown" } })
      expect((verdict as { warnings: string[] }).warnings.join()).toMatch(/not a recognised Neon branch/)
    })
  })

  describe("Vercel Preview / Development — the production URL is REFUSED", () => {
    it.each([VERCEL_PREVIEW, { VERCEL: "1", VERCEL_ENV: "development" }])("DATABASE_URL = production (%j)", (vercel) => {
      const verdict = assess({ env: { ...vercel, DATABASE_URL: PROD } })
      expect(verdict.action).toBe("refuse")
      expect((verdict as { reason: string }).reason).toMatch(/PRODUCTION database/)
    })

    it("a stale DIRECT_URL or DATABASE_URL_UNPOOLED on production is caught even when DATABASE_URL is staging (Prisma used to prefer them)", () => {
      for (const stale of ["DIRECT_URL", "DATABASE_URL_UNPOOLED"]) {
        const verdict = assess({ env: { ...VERCEL_PREVIEW, DATABASE_URL: STAGING, [stale]: PROD_DIRECT } })
        expect(verdict.action, stale).toBe("refuse")
        expect((verdict as { reason: string }).reason).toMatch(/do not name the same database/)
      }
    })

    it("only the staging branch is accepted: an unrecognised host cannot be shown NOT to be production", () => {
      expect(assess({ env: { ...VERCEL_PREVIEW, DATABASE_URL: OTHER_HOST } }).action).toBe("refuse")
      expect(assess({ env: { ...VERCEL_PREVIEW, DATABASE_URL: STAGING, DIRECT_URL: STAGING_DIRECT } })).toMatchObject({
        action: "run",
        target: { branch: "staging" },
      })
    })

    it("a preview with no database has nothing to migrate: skipped (and reported), not failed", () => {
      expect(assess({ env: { ...VERCEL_PREVIEW } })).toMatchObject({ action: "skip" })
    })
  })

  describe("no migration in a Vercel build — whatever the URL, the context or the environment variables", () => {
    const vercelContexts = [VERCEL_PROD, VERCEL_PREVIEW, { VERCEL: "1", VERCEL_ENV: "development" }]

    it("`migrate` is refused in every Vercel context, even against a perfectly valid target", () => {
      for (const vercel of vercelContexts) {
        const url = vercel.VERCEL_ENV === "production" ? PROD : STAGING
        const verdict = assess({ command: "migrate", env: { ...vercel, DATABASE_URL: url } })
        expect(verdict.action, JSON.stringify(vercel)).toBe("refuse")
        expect((verdict as { reason: string }).reason).toMatch(/never applies migrations/)
      }
    })

    it("BUILD_RUN_MIGRATIONS (the old switch) changes nothing: it is not even looked at", () => {
      for (const value of ["1", "0", "true", undefined]) {
        const env = { ...VERCEL_PROD, DATABASE_URL: PROD, BUILD_RUN_MIGRATIONS: value }
        expect(assess({ command: "migrate", env }).action, String(value)).toBe("refuse")
        expect(assess({ command: "verify", env }).action, String(value)).toBe("run")
      }
    })

    it("`verify` — the only thing a Vercel build does — is allowed on the right target", () => {
      expect(assess({ command: "verify", env: { ...VERCEL_PROD, DATABASE_URL: PROD } }).action).toBe("run")
      expect(assess({ command: "verify", env: { ...VERCEL_PREVIEW, DATABASE_URL: STAGING } }).action).toBe("run")
    })

    it("a local, explicit `migrate` is still possible — that is the separate step", () => {
      expect(assess({ command: "migrate", env: { DATABASE_URL: STAGING }, expectEndpoint: "ep-shy-wind-aly4bmc7" }).action).toBe("run")
    })
  })

  it("DATABASE_URL, DATABASE_URL_UNPOOLED and DIRECT_URL must all name the same endpoint, in every context", () => {
    for (const vercel of [VERCEL_PROD, VERCEL_PREVIEW, {}]) {
      const verdict = assess({ env: { ...vercel, DATABASE_URL: PROD, DIRECT_URL: STAGING_DIRECT }, expectEndpoint: "ep-misty-sea-al1ne07p", confirmProduction: true })
      expect(verdict.action).toBe("refuse")
    }
  })

  it("`vercel build` on a developer machine (VERCEL=1 + secret env files) is refused whatever the URL", () => {
    for (const url of [PROD, STAGING]) {
      for (const vercel of [VERCEL_PROD, VERCEL_PREVIEW]) {
        const verdict = assess({ env: { ...vercel, DATABASE_URL: url }, developerMachine: true })
        expect(verdict.action).toBe("refuse")
        expect((verdict as { reason: string }).reason).toMatch(/developer machine/)
      }
    }
  })

  it("VERCEL=1 without a usable VERCEL_ENV cannot be classified → refused", () => {
    expect(assess({ env: { VERCEL: "1", DATABASE_URL: STAGING } }).action).toBe("refuse")
  })

  describe("local", () => {
    it("migrate must say which database it means, and it must match", () => {
      expect((assess({ env: { DATABASE_URL: STAGING } }) as { reason: string }).reason).toMatch(/--expect-endpoint/)
      expect((assess({ env: { DATABASE_URL: STAGING }, expectEndpoint: "ep-other" }) as { reason: string }).reason).toMatch(/does not match/)
      expect(assess({ env: { DATABASE_URL: STAGING }, expectEndpoint: "ep-shy-wind-aly4bmc7" }).action).toBe("run")
    })

    it("production needs --confirm-production; verify (read-only) needs no ceremony", () => {
      const noConfirm = assess({ env: { DATABASE_URL: PROD }, expectEndpoint: "ep-misty-sea-al1ne07p" })
      expect((noConfirm as { reason: string }).reason).toMatch(/PRODUCTION/)
      expect(assess({ env: { DATABASE_URL: PROD }, expectEndpoint: "ep-misty-sea-al1ne07p-pooler", confirmProduction: true }).action).toBe("run")
      expect(assess({ env: { DATABASE_URL: PROD }, command: "verify" }).action).toBe("run")
    })

    it("no DATABASE_URL: refused — .env files are never a fallback", () => {
      expect((assess({ env: {} }) as { reason: string }).reason).toMatch(/\.env files are never read/)
    })
  })

  it("not a postgres URL → refused; no reason ever contains a password", () => {
    expect(assess({ env: { ...VERCEL_PROD, DATABASE_URL: "mysql://u:s3cr3t-pw@h/db" } }).action).toBe("refuse")
    const all = [
      assess({ env: { ...VERCEL_PREVIEW, DATABASE_URL: PROD } }),
      assess({ env: { ...VERCEL_PREVIEW, DATABASE_URL: STAGING, DIRECT_URL: PROD_DIRECT } }),
      assess({ env: { DATABASE_URL: PROD }, expectEndpoint: "ep-other" }),
      assess({ env: { ...VERCEL_PROD, DATABASE_URL: STAGING } }),
    ]
    expect(JSON.stringify(all)).not.toMatch(/s3cr3t/)
  })
})

/* -------------------------------------------------------------------------------------------------------------------
 * The orchestration, with Prisma and the catalog check injected.
 * ----------------------------------------------------------------------------------------------------------------- */

const NAMES_STAGING = 'Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech"\n\n3 migrations found in prisma/migrations\n\n'
const UP_TO_DATE = `${NAMES_STAGING}Database schema is up to date!`
const PENDING = `${NAMES_STAGING}Following migration have not yet been applied:\n20261007140000_event_spine\n\nTo apply migrations in production run prisma migrate deploy.`
const FAILED_STATUS = `${NAMES_STAGING}Following migration have failed:\n20261007140000_event_spine\n\nDuring development if the failed migration(s) have not been deployed ...`
const DIVERGED = `${NAMES_STAGING}Your local migration history and the migrations table from your database are different:\n\nThe migration have not yet been applied:\n20261007140000_event_spine`
const DEPLOY_OK = "Applying migration `20261007140000_event_spine`\n\nAll migrations have been successfully applied."
const DEPLOY_SQL_ERROR = "Error: P3018\n\nA migration failed to apply. New migrations cannot be applied before the error is recovered from.\n\nMigration name: 20261007140000_event_spine\n\nDatabase error: column \"anonymousId\" of relation \"AffisellTrackEvent\" already exists"
const DEPLOY_P3009 = "Error: P3009\n\nmigrate found failed migrations in the target database, new migrations will not be applied.\nThe `20261007140000_event_spine` migration started at 2026-10-07 18:00:00.0 UTC failed"
const P1001 = "Error: P1001: Can't reach database server at `ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech:5432`"
const P1002_LOCK = "Error: P1002 Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms. ep-shy-wind-aly4bmc7"

type Result = { status: number | null; text: string }

/** Scripted dependencies: each call pops the next scripted result; every call is recorded in `calls`. */
function scripted(script: { status?: Result[]; deploy?: Result[]; verify?: Result[] }) {
  const calls: string[] = []
  const logs: string[] = []
  const sleeps: number[] = []
  const queue = { status: [...(script.status ?? [])], deploy: [...(script.deploy ?? [])], verify: [...(script.verify ?? [])] }
  const next = (kind: keyof typeof queue): Result => {
    const result = queue[kind].shift()
    if (!result) throw new Error(`unexpected extra "${kind}" call`)
    return result
  }
  const deps = {
    log: (line: string) => void logs.push(line),
    error: (line: string) => void logs.push(line),
    sleep: async (ms: number) => void sleeps.push(ms),
    prisma: (sub: "status" | "deploy") => (calls.push(sub), next(sub)),
    verify: () => (calls.push("verify"), next("verify")),
  }
  return { deps, calls, logs, sleeps }
}

const ok = (text: string): Result => ({ status: 0, text })
const fail = (text: string, status = 1): Result => ({ status, text })
const VERIFIED = ok("Event-spine schema: PRESENT (15 found, 0 missing)\n✓ matches the expectation (present)")
/** What a Vercel build does: verify, on the staging database of a Preview. */
const staging = { env: { ...VERCEL_PREVIEW, DATABASE_URL: STAGING }, developerMachine: false, retryDelaysMs: [1, 2, 3] }
/** What a human (or a CI job) does BEFORE the push: migrate, with an explicit target. */
const local = { env: { DATABASE_URL: STAGING }, developerMachine: false, expectEndpoint: "ep-shy-wind-aly4bmc7", retryDelaysMs: [1, 2, 3] }

describe("schema:migrate — success", () => {
  it("TEST 1 — pending migration: status → deploy → status → catalog check, exit 0", async () => {
    const s = scripted({ status: [fail(PENDING), ok(UP_TO_DATE)], deploy: [ok(DEPLOY_OK)], verify: [VERIFIED] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.OK)
    expect(s.calls).toEqual(["status", "deploy", "status", "verify"])
    expect(s.logs.join("\n")).toMatch(/migrated and verified/)
  })

  it("nothing pending: no deploy, but the catalog is still checked", async () => {
    const s = scripted({ status: [ok(UP_TO_DATE)], verify: [VERIFIED] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.OK)
    expect(s.calls).toEqual(["status", "verify"])
  })

  it("a Vercel preview without a database verifies nothing and succeeds without touching anything", async () => {
    const s = scripted({})
    expect(await runSchemaDeploy("verify", { ...staging, env: { ...VERCEL_PREVIEW } }, s.deps)).toBe(EXIT.OK)
    expect(s.calls).toEqual([])
  })
})

describe("a Vercel build cannot migrate", () => {
  it("`migrate` in a Vercel context exits 2 and Prisma is never even asked", async () => {
    for (const env of [{ ...VERCEL_PROD, DATABASE_URL: PROD }, { ...VERCEL_PREVIEW, DATABASE_URL: STAGING }]) {
      const s = scripted({})
      const code = await runSchemaDeploy("migrate", { env, developerMachine: false, retryDelaysMs: [1] }, s.deps)
      expect(code).toBe(EXIT.REFUSED)
      expect(s.calls).toEqual([])
      expect(s.logs.join("\n")).toMatch(/never applies migrations/)
    }
  })

  it("`verify` in a Vercel context never calls `deploy`, whatever the migration state is", async () => {
    for (const state of [fail(PENDING), fail(FAILED_STATUS), fail(DIVERGED), ok(UP_TO_DATE)]) {
      const s = scripted({ status: [state], verify: [VERIFIED] })
      await runSchemaDeploy("verify", staging, s.deps)
      expect(s.calls).not.toContain("deploy")
    }
  })
})

describe("schema:migrate — failure is a HARD FAIL", () => {
  it("TEST 2 — `migrate deploy` exits non-zero: exit 4, and NOTHING after it runs (no second status, no catalog check)", async () => {
    const s = scripted({ status: [fail(PENDING)], deploy: [fail(DEPLOY_SQL_ERROR)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    expect(s.calls).toEqual(["status", "deploy"])
    expect(s.logs.join("\n")).toMatch(/migrate deploy FAILED/)
    expect(s.logs.join("\n")).toMatch(/no application build, no deployment/)
  })

  it("a deploy that exits 0 but leaves the schema not up to date is a failure too", async () => {
    const s = scripted({ status: [fail(PENDING), fail(PENDING)], deploy: [ok(DEPLOY_OK)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    expect(s.calls).toEqual(["status", "deploy", "status"]) // verify never ran
  })

  it("TEST 3 — the catalog check fails: exit 5", async () => {
    const s = scripted({ status: [ok(UP_TO_DATE)], verify: [fail("Event-spine schema: PARTIAL (9 found, 6 missing)")] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.VERIFY_FAILED)
    expect(s.logs.join("\n")).toMatch(/schema verification FAILED/)
  })

  it("TEST 3b — `migrate status` says up to date but the catalog is empty: still exit 5 (status alone proves nothing)", async () => {
    const s = scripted({ status: [ok(UP_TO_DATE)], verify: [fail("Event-spine schema: ABSENT (0 found, 15 missing)")] })
    expect(await runSchemaDeploy("verify", staging, s.deps)).toBe(EXIT.VERIFY_FAILED)
  })

  it("Prisma not naming the expected endpoint aborts BEFORE any write (exit 3)", async () => {
    const s = scripted({ status: [ok('Datasource "db" at "ep-someone-else-0000.neon.tech"\nDatabase schema is up to date!')] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.UNPROVEN_TARGET)
    expect(s.calls).toEqual(["status"])
  })

  it("a refused target runs nothing at all (exit 2)", async () => {
    const s = scripted({})
    const prodInPreview = { ...staging, env: { ...VERCEL_PREVIEW, DATABASE_URL: PROD } }
    expect(await runSchemaDeploy("verify", prodInPreview, s.deps)).toBe(EXIT.REFUSED)
    expect(s.calls).toEqual([])
    expect(s.logs.join("\n")).not.toMatch(/s3cr3t/)
  })

  it("a diverged history, or a database Prisma does not manage, is NOT 'pending': nothing is deployed (exit 4)", async () => {
    const s = scripted({ status: [fail(DIVERGED)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    expect(s.calls).toEqual(["status"])
    const unmanaged = scripted({ status: [fail(`${NAMES_STAGING}The current database is not managed by Prisma Migrate.`)] })
    expect(await runSchemaDeploy("migrate", local, unmanaged.deps)).toBe(EXIT.MIGRATION_FAILED)
  })
})

describe("TEST 4 — P3009: a failed migration is never replayed, never hidden, never recorded as applied", () => {
  it("a failed migration already in the history stops the pipeline BEFORE `migrate deploy`", async () => {
    const s = scripted({ status: [fail(FAILED_STATUS)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    expect(s.calls).toEqual(["status"]) // no deploy, no verify, no 'heal'
    const out = s.logs.join("\n")
    expect(out).toMatch(/FAILED migration\(s\)/)
    expect(out).toMatch(/nothing will be marked as applied/i)
    expect(out).toMatch(/resolve --rolled-back/)
    expect(out).not.toMatch(/--applied/)
  })

  it("verify mode: a failed migration fails verification (exit 5), it is never an 'up to date'", async () => {
    const s = scripted({ status: [fail(FAILED_STATUS)] })
    expect(await runSchemaDeploy("verify", staging, s.deps)).toBe(EXIT.VERIFY_FAILED)
    expect(s.calls).toEqual(["status"])
  })

  it("a deploy that hits P3009 does not trigger a second 'repair cycle': one deploy call, exit 4, guidance printed", async () => {
    const s = scripted({ status: [fail(PENDING)], deploy: [fail(DEPLOY_P3009)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    expect(s.calls).toEqual(["status", "deploy"])
    expect(s.logs.join("\n")).toMatch(/20261007140000_event_spine/)
    expect(s.logs.join("\n")).toMatch(/resolve --rolled-back/)
  })

  it("the dependency surface has no way to heal or to mark anything applied: only status, deploy and verify exist", async () => {
    const s = scripted({ status: [fail(FAILED_STATUS)] })
    expect(Object.keys(s.deps).sort()).toEqual(["error", "log", "prisma", "sleep", "verify"])
    await runSchemaDeploy("migrate", local, s.deps)
    for (const call of s.calls) expect(["status", "deploy", "verify"]).toContain(call)
  })
})

describe("transient database errors are retried, then they are a failure", () => {
  it("Neon waking up: P1001 on the first status, then it works", async () => {
    const s = scripted({ status: [fail(P1001), ok(UP_TO_DATE)], verify: [VERIFIED] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.OK)
    expect(s.sleeps).toEqual([1])
  })

  it("still unreachable after every retry: exit 4, and no deploy is attempted", async () => {
    const s = scripted({ status: [fail(P1001), fail(P1001), fail(P1001), fail(P1001)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    expect(s.sleeps).toEqual([1, 2, 3])
    expect(s.calls).toEqual(["status", "status", "status", "status"])
  })

  it("a held migration lock (P1002) is retried, then fails with a diagnosis — and NOTHING is killed", async () => {
    const s = scripted({ status: [fail(PENDING)], deploy: [fail(P1002_LOCK), fail(P1002_LOCK), fail(P1002_LOCK), fail(P1002_LOCK)] })
    expect(await runSchemaDeploy("migrate", local, s.deps)).toBe(EXIT.MIGRATION_FAILED)
    const out = s.logs.join("\n")
    expect(out).toMatch(/Nothing was killed/)
    expect(out).toMatch(/npm run db:unlock/)
    expect(s.calls.filter((c) => c === "deploy")).toHaveLength(4)
  })

  it("a SQL error is NOT retried (retrying a half-run migration would only turn it into P3009)", async () => {
    const s = scripted({ status: [fail(PENDING)], deploy: [fail(DEPLOY_SQL_ERROR)] })
    await runSchemaDeploy("migrate", local, s.deps)
    expect(s.sleeps).toEqual([])
  })
})

describe("schema:verify — read-only", () => {
  it("up to date + catalog present: exit 0 and Prisma is only asked for `status`", async () => {
    const s = scripted({ status: [ok(UP_TO_DATE)], verify: [VERIFIED] })
    expect(await runSchemaDeploy("verify", staging, s.deps)).toBe(EXIT.OK)
    expect(s.calls).toEqual(["status", "verify"])
  })

  it("a pending migration is a verification failure (exit 5): verify never deploys", async () => {
    const s = scripted({ status: [fail(PENDING)] })
    expect(await runSchemaDeploy("verify", staging, s.deps)).toBe(EXIT.VERIFY_FAILED)
    expect(s.calls).toEqual(["status"])
    expect(s.logs.join("\n")).toMatch(/20261007140000_event_spine not applied/)
  })
})

describe("parseCli", () => {
  it("migrate / verify and their flags", () => {
    expect(parseCli(["migrate", "--expect-endpoint", "ep-x", "--confirm-production", "--no-retry"])).toMatchObject({
      command: "migrate",
      expectEndpoint: "ep-x",
      confirmProduction: true,
      retry: false,
      error: "",
    })
    expect(parseCli(["verify"])).toMatchObject({ command: "verify", retry: true, error: "" })
  })
  it("anything else is an error", () => {
    expect(parseCli([]).error).toMatch(/usage/)
    expect(parseCli(["deploy"]).error).toMatch(/usage/)
    expect(parseCli(["migrate", "--yolo"]).error).toMatch(/unknown argument/)
  })
})

/* -------------------------------------------------------------------------------------------------------------------
 * `db:unlock`: the application's own advisory locks are never touched.
 * ----------------------------------------------------------------------------------------------------------------- */

describe("classifyAdvisoryLocks — the safe replacement for 'kill every session that holds an advisory lock'", () => {
  const prismaLock = { classid: "0", objid: String(PRISMA_MIGRATION_LOCK_KEY), objsubid: 1, granted: true }
  // pg_advisory_xact_lock(hashtext('checkout-fulfill:cs_123')): an int4 key → another objid; held by a payment transaction.
  const appLock = { classid: "0", objid: "3141592653", objsubid: 1, granted: true }

  it("the key is the one Prisma's schema engine takes", () => {
    expect(PRISMA_MIGRATION_LOCK_KEY).toBe(72707369)
  })

  it("a stale Prisma migration session (holds only that lock, idle for minutes) is the ONLY thing that can be terminated", () => {
    const [session] = classifyAdvisoryLocks([{ pid: 4242, ...prismaLock, state: "idle", state_age_seconds: 600 }])
    expect(session).toMatchObject({ pid: 4242, kind: "prisma-migration", terminable: true, reasons: [] })
  })

  it("a payment / fulfilment / Medusa-sync transaction (application advisory lock) is NEVER terminable, whatever its state", () => {
    for (const state of ["active", "idle", "idle in transaction"]) {
      const [session] = classifyAdvisoryLocks([{ pid: 7, ...appLock, state, state_age_seconds: 9999 }])
      expect(session, state).toMatchObject({ kind: "application", terminable: false })
      expect(session.reasons.join()).toMatch(/application lock, never terminated/)
    }
  })

  it("a session holding Prisma's lock AND an application lock is not a pure migration session → kept", () => {
    const [session] = classifyAdvisoryLocks([
      { pid: 9, ...prismaLock, state: "idle", state_age_seconds: 900 },
      { pid: 9, ...appLock, state: "idle", state_age_seconds: 900 },
    ])
    expect(session.terminable).toBe(false)
    expect(session.reasons.join()).toMatch(/other advisory lock/)
  })

  it("a migration that is running (active) or only just went idle is left alone", () => {
    expect(classifyAdvisoryLocks([{ pid: 1, ...prismaLock, state: "active", state_age_seconds: 900 }])[0].terminable).toBe(false)
    expect(classifyAdvisoryLocks([{ pid: 1, ...prismaLock, state: "idle", state_age_seconds: 30 }])[0].terminable).toBe(false)
    expect(classifyAdvisoryLocks([{ pid: 1, ...prismaLock, state: "idle", state_age_seconds: 119 }])[0].terminable).toBe(false)
    expect(classifyAdvisoryLocks([{ pid: 1, ...prismaLock, state: "idle", state_age_seconds: 120 }])[0].terminable).toBe(true)
  })

  it("a session WAITING for Prisma's lock is the victim, not the cause: never terminable", () => {
    const [session] = classifyAdvisoryLocks([{ pid: 5, ...prismaLock, granted: false, state: "active", state_age_seconds: 10 }])
    expect(session).toMatchObject({ kind: "prisma-migration-waiting", terminable: false })
  })

  it("is tolerant of what the database driver returns (bigint pids, numeric strings)", () => {
    const [session] = classifyAdvisoryLocks([
      { pid: BigInt(4242), classid: 0, objid: 72707369, objsubid: "1", granted: true, state: "idle", state_age_seconds: "600" },
    ])
    expect(session).toMatchObject({ pid: 4242, terminable: true })
  })

  it("groups the locks of one pid, sorted", () => {
    const sessions = classifyAdvisoryLocks([
      { pid: 20, ...appLock, state: "active", state_age_seconds: 1 },
      { pid: 10, ...prismaLock, state: "idle", state_age_seconds: 500 },
      { pid: 20, ...appLock, state: "active", state_age_seconds: 1 },
    ])
    expect(sessions.map((s) => s.pid)).toEqual([10, 20])
  })
})

/* -------------------------------------------------------------------------------------------------------------------
 * Real processes. Same environment hygiene as verify-event-spine-script.test.ts: nothing is inherited from the developer's
 * shell, so no real DATABASE_URL can leak into these runs.
 * ----------------------------------------------------------------------------------------------------------------- */

const SCRIPT = resolve("scripts/schema-deploy.mjs")
function run(env: Record<string, string>, args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 120_000,
  })
}

describe("the real script (subprocess)", () => {
  it("TEST 7 — a production-looking endpoint in a Preview is refused before anything is run: exit 2", () => {
    const result = run({ ...VERCEL_PREVIEW, DATABASE_URL: PROD_LOOKING_UNREACHABLE }, ["verify"], tempDir())
    expect(result.status).toBe(EXIT.REFUSED)
    expect(result.stderr).toMatch(/REFUSED.*PRODUCTION database/)
    expect(result.stdout + result.stderr).not.toMatch(/s3cr3t/)
    expect(result.stdout).toMatch(/DATABASE_URL → ep-misty-sea/) // the log names what it saw: the proof to read in a Vercel build log
  })

  it("`migrate` in a Vercel context is refused with exit 2 — production or preview, valid target or not, BUILD_RUN_MIGRATIONS or not", () => {
    for (const vercel of [VERCEL_PROD, VERCEL_PREVIEW]) {
      const result = run({ ...vercel, BUILD_RUN_MIGRATIONS: "1", DATABASE_URL: PROD_LOOKING_UNREACHABLE }, ["migrate"], tempDir())
      expect(result.status).toBe(EXIT.REFUSED)
      expect(result.stderr).toMatch(/never applies migrations/)
    }
  })

  it("VERCEL=1 on a developer machine (an .env.local in the working directory) is refused: exit 2", () => {
    const result = run({ ...VERCEL_PROD, DATABASE_URL: PROD_LOOKING_UNREACHABLE }, ["verify"], tempDir({ ".env.local": "X=1" }))
    expect(result.status).toBe(EXIT.REFUSED)
    expect(result.stderr).toMatch(/developer machine/)
  })

  it("Production without a database is refused (exit 2); Preview without a database passes (exit 0, nothing run)", () => {
    expect(run({ ...VERCEL_PROD }, ["verify"], tempDir()).status).toBe(EXIT.REFUSED)
    const preview = run({ ...VERCEL_PREVIEW }, ["verify"], tempDir())
    expect(preview.status).toBe(EXIT.OK)
    expect(preview.stdout).toMatch(/skipped/)
  })

  it("usage errors exit 2", () => {
    expect(run({}, [], tempDir()).status).toBe(EXIT.REFUSED)
    expect(run({}, ["deploy"], tempDir()).status).toBe(EXIT.REFUSED)
  })

  it("TEST 2 (real Prisma) — an unreachable database makes `schema:migrate` exit 4 and nothing after the failed read runs", () => {
    // Port 9 on localhost: nothing listens. Real `prisma migrate status` runs and fails with P1001.
    const result = run(
      { DATABASE_URL: "postgresql://nobody:nobody@127.0.0.1:9/none?connect_timeout=2" },
      ["migrate", "--expect-endpoint", "127.0.0.1", "--no-retry"]
    )
    expect(result.status).toBe(EXIT.MIGRATION_FAILED)
    expect(result.stderr).toMatch(/migration state is not readable/)
    expect(result.stdout + result.stderr).not.toMatch(/migrated and verified|✓ \[schema\]/)
  }, 120_000)
})
