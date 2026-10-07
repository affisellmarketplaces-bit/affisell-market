import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  assessInvocation,
  buildChildEnv,
  directUrlOf,
  endpointOf,
  isTransientDbError,
  isUpToDate,
  normalizeEndpoint,
  parseArgs,
  parseFailedMigrations,
  parsePendingMigrations,
  READ_ONLY_SESSION_OPTION,
  withReadOnlySession,
} from "../../scripts/prisma-explicit-db.mjs"

/**
 * `prisma.config.ts` loads .env.local with override:true, so `DATABASE_URL=… prisma migrate deploy` hits the DEFAULT
 * database. This helper must make that mistake impossible: explicit URL only, endpoint named before any write,
 * production behind an extra flag, and nothing but `status` / `deploy` / `resolve --rolled-back` (never `--applied`).
 */

const PROD = "postgresql://user:p%40ss-w0rd@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
const STAGING = "postgresql://user:p%40ss-w0rd@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

describe("parseArgs", () => {
  it("reads the command and the flags", () => {
    expect(parseArgs(["deploy", "--expect-endpoint", "ep-x", "--confirm-production"])).toEqual({
      command: "deploy",
      expectEndpoint: "ep-x",
      confirmProduction: true,
      rolledBack: "",
    })
    expect(parseArgs(["status"])).toEqual({ command: "status", expectEndpoint: "", confirmProduction: false, rolledBack: "" })
    expect(parseArgs(["resolve", "--rolled-back", "20261007140000_event_spine"]).rolledBack).toBe("20261007140000_event_spine")
  })

  it("an unknown argument is an error, not silently ignored", () => {
    expect(parseArgs(["deploy", "--yolo"]).error).toMatch(/unknown argument/)
  })
})

describe("normalizeEndpoint / directUrlOf", () => {
  it("the pooled and direct hosts are the same endpoint", () => {
    expect(normalizeEndpoint("ep-misty-sea-al1ne07p-pooler")).toBe("ep-misty-sea-al1ne07p")
    expect(normalizeEndpoint(" EP-Misty-Sea-al1ne07p ")).toBe("ep-misty-sea-al1ne07p")
  })

  it("Prisma Migrate gets the direct URL", () => {
    const direct = new URL(directUrlOf(PROD))
    expect(direct.hostname).not.toContain("-pooler")
    expect(direct.searchParams.has("pgbouncer")).toBe(false)
    expect(direct.searchParams.get("sslmode")).toBe("require")
    expect(direct.searchParams.get("connect_timeout")).toBe("60")
  })
})

describe("buildChildEnv — only the given database survives", () => {
  it("drops every other database variable and sets the three URLs from the one given", () => {
    const env = buildChildEnv(
      {
        PATH: "/usr/bin",
        HOME: "/home/x",
        DATABASE_URL: PROD,
        DATABASE_URL_STAGING: STAGING,
        DATABASE_URL_TEST: STAGING,
        DIRECT_URL: PROD,
        RADAR_DATABASE_URL: PROD,
        POSTGRES_URL: PROD,
        PGPASSWORD: "x",
        STRIPE_SECRET_KEY: "sk_test_keep",
      },
      STAGING
    )
    expect(env.DATABASE_URL).toBe(STAGING)
    expect(env.DATABASE_URL_UNPOOLED).toContain("ep-shy-wind-aly4bmc7")
    expect(env.DIRECT_URL).toContain("ep-shy-wind-aly4bmc7")
    for (const key of ["DATABASE_URL_STAGING", "DATABASE_URL_TEST", "RADAR_DATABASE_URL", "POSTGRES_URL", "PGPASSWORD"]) {
      expect(env[key], key).toBeUndefined()
    }
    expect(JSON.stringify(env)).not.toContain("misty-sea")
    expect(env.PATH).toBe("/usr/bin")
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_keep")
  })
})

describe("assessInvocation — decided BEFORE anything is run", () => {
  const base = { rawUrl: STAGING, expectEndpoint: "", confirmProduction: false }

  it("status works on any database, read-only, without ceremony", () => {
    expect(assessInvocation({ ...base, command: "status" }).ok).toBe(true)
    expect(assessInvocation({ ...base, command: "status", rawUrl: PROD }).ok).toBe(true)
  })

  it("deploy must say which database it means", () => {
    const missing = assessInvocation({ ...base, command: "deploy" })
    expect(missing.ok).toBe(false)
    expect(missing.reason).toMatch(/--expect-endpoint/)
  })

  it("deploy refuses when the expected endpoint is not the URL's endpoint", () => {
    const wrong = assessInvocation({ ...base, command: "deploy", expectEndpoint: "ep-misty-sea-al1ne07p" })
    expect(wrong.ok).toBe(false)
    expect(wrong.reason).toMatch(/does not match/)
    expect(wrong.reason).toMatch(/Nothing was run/)
  })

  it("deploy on staging with the right endpoint is allowed", () => {
    const ok = assessInvocation({ ...base, command: "deploy", expectEndpoint: "ep-shy-wind-aly4bmc7" })
    expect(ok).toMatchObject({ ok: true, endpoint: "ep-shy-wind-aly4bmc7", branch: "staging" })
  })

  it("deploy on PRODUCTION needs the extra confirmation — and the pooled/direct spelling of the endpoint does not matter", () => {
    const noConfirm = assessInvocation({ ...base, rawUrl: PROD, command: "deploy", expectEndpoint: "ep-misty-sea-al1ne07p" })
    expect(noConfirm.ok).toBe(false)
    expect(noConfirm.reason).toMatch(/PRODUCTION/)
    const confirmed = assessInvocation({ ...base, rawUrl: PROD, command: "deploy", expectEndpoint: "ep-misty-sea-al1ne07p-pooler", confirmProduction: true })
    expect(confirmed).toMatchObject({ ok: true, branch: "production" })
  })

  it("nothing but status, deploy and resolve exists (no db push, no migrate dev, no reset, no free-form command)", () => {
    for (const command of ["push", "dev", "reset", "studio", "db", "diff", "", undefined]) {
      expect(assessInvocation({ ...base, command: command as string }).ok, String(command)).toBe(false)
    }
  })

  describe("resolve — manual, explicit, and only ever `--rolled-back`", () => {
    const resolveBase = { ...base, command: "resolve", expectEndpoint: "ep-shy-wind-aly4bmc7", rolledBack: "20261007140000_event_spine" }

    it("needs a well-formed migration name: there is no way to say `--applied`", () => {
      for (const rolledBack of ["", "--applied", "event_spine", "20261007140000_event spine", "../x", undefined]) {
        const verdict = assessInvocation({ ...resolveBase, rolledBack })
        expect(verdict.ok, String(rolledBack)).toBe(false)
        expect(verdict.reason).toMatch(/--rolled-back/)
      }
      expect(parseArgs(["resolve", "--applied", "20261007140000_event_spine"]).error).toMatch(/unknown argument/)
    })

    it("is a WRITE: same ceremony as deploy (endpoint named and matching, production confirmed)", () => {
      expect(assessInvocation(resolveBase).ok).toBe(true)
      expect(assessInvocation({ ...resolveBase, expectEndpoint: "" }).reason).toMatch(/--expect-endpoint/)
      expect(assessInvocation({ ...resolveBase, expectEndpoint: "ep-other" }).reason).toMatch(/does not match/)
      const prod = { ...resolveBase, rawUrl: PROD, expectEndpoint: "ep-misty-sea-al1ne07p" }
      expect(assessInvocation(prod).reason).toMatch(/PRODUCTION/)
      expect(assessInvocation({ ...prod, confirmProduction: true }).ok).toBe(true)
    })
  })

  it("a host that is not a Neon endpoint is named by its host (so a local / CI database can be addressed too)", () => {
    const local = assessInvocation({ ...base, command: "deploy", rawUrl: "postgresql://u:p@127.0.0.1:5433/db", expectEndpoint: "127.0.0.1" })
    expect(local).toMatchObject({ ok: true, endpoint: "127.0.0.1" })
    expect(endpointOf({ endpointId: "", host: "db.internal:5432" } as never)).toBe("db.internal")
  })

  it("no URL, or something that is not a postgres URL, is refused — .env files are never a fallback", () => {
    for (const rawUrl of ["", "   ", "mysql://u:p@h/db", "not a url"]) {
      const verdict = assessInvocation({ ...base, command: "status", rawUrl })
      expect(verdict.ok, rawUrl).toBe(false)
      expect(verdict.reason).toMatch(/DATABASE_URL/)
    }
  })

  it("a reason never contains the password", () => {
    const reasons = [
      assessInvocation({ ...base, rawUrl: PROD, command: "deploy" }),
      assessInvocation({ ...base, rawUrl: PROD, command: "deploy", expectEndpoint: "ep-other" }),
      assessInvocation({ ...base, rawUrl: PROD, command: "deploy", expectEndpoint: "ep-misty-sea-al1ne07p" }),
    ]
    for (const r of reasons) expect(JSON.stringify(r)).not.toMatch(/p%40ss|p@ss|w0rd/)
  })
})

/**
 * What Prisma 6.19 really prints (read from node_modules/prisma/build/index.js): the decisions of the pipeline are built on
 * these texts, so a failure to recognise one must fail CLOSED — never be read as "nothing to do".
 */
describe("reading Prisma's own output", () => {
  const HEADER = 'Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech"\n\n3 migrations found in prisma/migrations\n\n'
  const UP_TO_DATE = `${HEADER}Database schema is up to date!`
  const PENDING_ONE = `${HEADER}Following migration have not yet been applied:\n20261007140000_event_spine\n\nTo apply migrations in development run prisma migrate dev.\nTo apply migrations in production run prisma migrate deploy.`
  const PENDING_TWO = `${HEADER}Following migrations have not yet been applied:\n20261007140000_event_spine\n20261008090000_next_one\n\nTo apply migrations in development run prisma migrate dev.`
  const FAILED = `${HEADER}Following migration have failed:\n20261007140000_event_spine\n\nDuring development if the failed migration(s) have not been deployed to a production database you can then fix the migration(s) and run prisma migrate dev.\n\nThe failed migration(s) can be marked as rolled back or applied:\n\n- If you rolled back the migration(s) manually:\nprisma migrate resolve --rolled-back "20261007140000_event_spine"`
  const P3009 = "Error: P3009\n\nmigrate found failed migrations in the target database, new migrations will not be applied.\nThe `20261007140000_event_spine` migration started at 2026-10-07 18:00:00.0 UTC failed"
  const DIVERGED = `${HEADER}Your local migration history and the migrations table from your database are different:\n\nThe last common migration is: 20261001000000_x\n\nThe migration have not yet been applied:\n20261007140000_event_spine\n\nThe migrations from the database are not found locally in prisma/migrations:\n20261007150000_other`

  it("up to date", () => {
    expect(isUpToDate(UP_TO_DATE)).toBe(true)
    expect(parsePendingMigrations(UP_TO_DATE)).toEqual([])
    expect(parseFailedMigrations(UP_TO_DATE)).toEqual([])
    for (const text of [PENDING_ONE, FAILED, DIVERGED, "", "Error: P1001"]) expect(isUpToDate(text)).toBe(false)
  })

  it("pending — singular and plural, names only", () => {
    expect(parsePendingMigrations(PENDING_ONE)).toEqual(["20261007140000_event_spine"])
    expect(parsePendingMigrations(PENDING_TWO)).toEqual(["20261007140000_event_spine", "20261008090000_next_one"])
  })

  it("failed — from `migrate status` and from the P3009 error of `migrate deploy`", () => {
    expect(parseFailedMigrations(FAILED)).toEqual(["20261007140000_event_spine"])
    expect(parseFailedMigrations(P3009)).toEqual(["20261007140000_event_spine"])
    expect(parsePendingMigrations(FAILED)).toEqual([])
  })

  it("diverged histories are neither 'pending' nor 'up to date' → the caller must refuse", () => {
    expect(parsePendingMigrations(DIVERGED)).toEqual([])
    expect(isUpToDate(DIVERGED)).toBe(false)
    expect(parseFailedMigrations(DIVERGED)).toEqual([])
  })

  it("transient connection problems (retried) vs everything else (not)", () => {
    for (const text of [
      "Error: P1001: Can't reach database server at `ep-x.neon.tech:5432`",
      "P1002 The database server was reached but timed out",
      "Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms.",
      "P1017 Server has closed the connection",
      "connect ECONNREFUSED 127.0.0.1:5432",
    ]) {
      expect(isTransientDbError(text), text).toBe(true)
    }
    for (const text of [P3009, FAILED, DIVERGED, "Error: P3018 A migration failed to apply", "syntax error at or near", ""]) {
      expect(isTransientDbError(text), text).toBe(false)
    }
  })
})

describe("read-only SESSION — `status` and the catalog check cannot write because the database server refuses", () => {
  it("withReadOnlySession adds the startup option and swaps Neon's pooler host (which rejects startup options) for the direct one", () => {
    const url = new URL(withReadOnlySession(PROD))
    expect(url.searchParams.get("options")).toBe(READ_ONLY_SESSION_OPTION)
    expect(url.hostname).toBe("ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech")
    expect(READ_ONLY_SESSION_OPTION).toBe("-c default_transaction_read_only=on")
  })

  it("is idempotent, keeps an existing `options`, and does not force SSL on a local database", () => {
    const once = withReadOnlySession(STAGING)
    expect(withReadOnlySession(once)).toBe(once)
    const withOther = new URL(withReadOnlySession("postgresql://u:p@127.0.0.1:5433/db?options=-c%20statement_timeout%3D5000"))
    expect(withOther.searchParams.get("options")).toBe(`-c statement_timeout=5000 ${READ_ONLY_SESSION_OPTION}`)
    expect(withOther.searchParams.has("sslmode")).toBe(false)
  })

  it("buildChildEnv({ readOnly }) puts the read-only session on ALL THREE urls Prisma may read; without it nothing changes", () => {
    const ro = buildChildEnv({ PATH: "/usr/bin" }, PROD, { readOnly: true })
    for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL"]) {
      const url = new URL(ro[key]!)
      expect(url.searchParams.get("options"), key).toBe(READ_ONLY_SESSION_OPTION)
      expect(url.hostname, key).not.toContain("-pooler")
    }
    const normal = buildChildEnv({ PATH: "/usr/bin" }, PROD)
    for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL"]) expect(normal[key], key).not.toContain("options=")
    expect(normal.DATABASE_URL).toBe(PROD) // a write (deploy) still gets the plain URL
  })

  it("the explicit runner uses the read-only env for its proving `status` and the plain env for deploy (source check)", () => {
    const source = readFileSync("scripts/prisma-explicit-db.mjs", "utf8")
    expect(source).toMatch(/readOnlyEnv = buildChildEnv\(process\.env, rawUrl, \{ readOnly: true \}\)/)
    expect(source).toMatch(/runPrisma\("status", readOnlyEnv/)
    expect(source).toMatch(/runPrisma\("deploy", env,/)
  })
})
