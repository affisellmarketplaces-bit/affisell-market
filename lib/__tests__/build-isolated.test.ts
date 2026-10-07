import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  ALLOW_DB_FLAG,
  DEVELOPER_ENV_FILES,
  EXTERNAL_EFFECT_ENV_KEYS,
  ISOLATED_ENV_KEYS,
  NEXT_BUILD_ENV_FILES,
  collectDatastoreKeys,
  describePlan,
  findProductionDatabaseKeys,
  hasDeveloperEnvFiles,
  nextBuildEnv,
  planBuild,
  readBuildEnvFiles,
} from "../../scripts/build-isolated.mjs"

/**
 * `npm run build` on a developer machine or in CI must not be able to reach a database. The wrapper removes the
 * credentials from the environment of `next build` — including those Next would load from `.env*` files.
 */

const PROD = "postgresql://user:s3cr3t-password@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const STAGING = "postgresql://user:s3cr3t-password@ep-shy-wind-aly4bmc7-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const REDIS = "https://eu1-fake.upstash.io"

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function tempDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "build-isolated-"))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe("planBuild — Vercel", () => {
  it("leaves Vercel's own build untouched: static pages keep the database they are configured with", () => {
    const processEnv = { VERCEL: "1", DATABASE_URL: PROD, UPSTASH_REDIS_REST_URL: REDIS, PATH: "/usr/bin" }
    const plan = planBuild(processEnv, [{ DATABASE_URL_STAGING: STAGING }])
    expect(plan.mode).toBe("vercel")
    expect(plan.env).toEqual(processEnv)
    expect(plan.blanked).toEqual([])
  })
})

describe("planBuild — `vercel build` run LOCALLY is not a Vercel builder", () => {
  const laptop = { VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL: PROD, UPSTASH_REDIS_REST_URL: REDIS, PATH: "/usr/bin" }

  it("VERCEL=1 on a developer machine (secret env files present) is isolated exactly like `npm run build`", () => {
    const plan = planBuild(laptop, [{ DATABASE_URL: PROD }], { developerMachine: true })
    expect(plan.mode).toBe("isolated")
    expect(plan.localVercel).toBe(true)
    expect(plan.env.DATABASE_URL).toBe("")
    expect(plan.env.UPSTASH_REDIS_REST_URL).toBe("")
    expect(plan.env.PATH).toBe("/usr/bin")
    expect(describePlan(plan)).toMatch(/developer machine/)
  })

  it("on a real Vercel builder (no secret env files) nothing changes", () => {
    for (const options of [undefined, {}, { developerMachine: false }]) {
      const plan = planBuild(laptop, [], options)
      expect(plan.mode).toBe("vercel")
      expect(plan.env).toEqual(laptop)
      expect(plan.localVercel).toBeUndefined()
    }
  })

  it("the escape hatch still refuses production on that machine", () => {
    const plan = planBuild({ ...laptop, [ALLOW_DB_FLAG]: "1" }, [], { developerMachine: true })
    expect(plan.mode).toBe("refused")
    expect(plan.production.map(([key]) => key)).toContain("DATABASE_URL")
  })

  it("developer machine = a secret env file is present; `.env.example` and friends do not count", () => {
    for (const name of DEVELOPER_ENV_FILES) expect(hasDeveloperEnvFiles(tempDir({ [name]: "X=1" })), name).toBe(true)
    expect(hasDeveloperEnvFiles(tempDir({ ".env.example": "X=1", ".env.local.example": "X=1", "package.json": "{}" }))).toBe(false)
    expect(hasDeveloperEnvFiles(tempDir())).toBe(false) // a bare checkout: Vercel, CI
  })

  it("the signal is reliable: none of those files is tracked by git, so a Vercel checkout cannot contain one", () => {
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n")
    for (const name of DEVELOPER_ENV_FILES) expect(tracked, name).not.toContain(name)
  })
})

describe("the build's own external side effects (measured with a network tripwire)", () => {
  it("Next.js telemetry is off by default (it was 14 POSTs to telemetry.nextjs.org per build) and an explicit choice is respected", () => {
    expect(nextBuildEnv({ PATH: "/usr/bin" }).NEXT_TELEMETRY_DISABLED).toBe("1")
    expect(nextBuildEnv({ NEXT_TELEMETRY_DISABLED: "0" }).NEXT_TELEMETRY_DISABLED).toBe("0")
    expect(nextBuildEnv({ PATH: "/usr/bin" }).PATH).toBe("/usr/bin")
  })

  it("a local / CI build never uploads to Sentry: the token is blanked in isolated AND allow-db mode, wherever it is defined", () => {
    const fromFile = [{ SENTRY_AUTH_TOKEN: "sntrys_real", SENTRY_ORG: "o", SENTRY_PROJECT: "p" }]
    for (const processEnv of [{}, { SENTRY_AUTH_TOKEN: "sntrys_real" }, { [ALLOW_DB_FLAG]: "1" }]) {
      const plan = planBuild(processEnv, fromFile)
      expect(["isolated", "allow-db"]).toContain(plan.mode)
      expect(plan.env.SENTRY_AUTH_TOKEN).toBe("") // defined-but-empty: Next never fills it back from .env.local
      expect(plan.env.SENTRY_ORG).toBeUndefined() // only the token is needed to switch the plugin off
    }
    expect(EXTERNAL_EFFECT_ENV_KEYS).toEqual(["SENTRY_AUTH_TOKEN"])
  })

  it("on a real Vercel builder the upload stays (it is the point of the credentials there)", () => {
    const env = { VERCEL: "1", SENTRY_AUTH_TOKEN: "sntrys_real" }
    expect(planBuild(env, []).env.SENTRY_AUTH_TOKEN).toBe("sntrys_real")
  })

  it("next.config.ts needs token AND org AND project to run the Sentry plugin, so an empty token switches it off; its own telemetry is off", () => {
    const config = readFileSync("next.config.ts", "utf8")
    expect(config).toMatch(/hasUploadCredentials = Boolean\(authToken && org && project\)/)
    expect(config).toMatch(/telemetry: false/)
  })
})

describe("planBuild — local and CI builds are isolated", () => {
  const fileEnv = {
    DATABASE_URL: PROD,
    DATABASE_URL_STAGING: STAGING,
    UPSTASH_REDIS_REST_URL: REDIS,
    UPSTASH_REDIS_REST_TOKEN: "tok",
    SOME_CUSTOM_PG_LINK: "postgres://u:p@somewhere/db", // a name nobody listed: recognised by the SHAPE of its value
    SOME_REDIS: "rediss://default:p@host:6379",
    STRIPE_SECRET_KEY: "sk_test_keep_me",
    HARMLESS: "1",
  }

  it("removes every datastore credential — by name AND by the shape of the value — wherever it comes from", () => {
    const plan = planBuild({ PATH: "/usr/bin", DATABASE_URL: PROD, RADAR_DATABASE_URL: PROD, STRIPE_SECRET_KEY: "sk_test_keep_me" }, [fileEnv])
    expect(plan.mode).toBe("isolated")
    for (const key of [
      "DATABASE_URL", "DATABASE_URL_STAGING", "RADAR_DATABASE_URL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
      "SOME_CUSTOM_PG_LINK", "SOME_REDIS",
    ]) {
      expect(plan.env[key], key).toBe("")
      expect(plan.blanked, key).toContain(key)
    }
  })

  it("leaves everything else alone", () => {
    const plan = planBuild({ PATH: "/usr/bin", STRIPE_SECRET_KEY: "sk_test_keep_me", NEXT_PUBLIC_X: "y" }, [fileEnv])
    expect(plan.env.PATH).toBe("/usr/bin")
    expect(plan.env.STRIPE_SECRET_KEY).toBe("sk_test_keep_me")
    expect(plan.env.NEXT_PUBLIC_X).toBe("y")
    expect(plan.blanked).not.toContain("STRIPE_SECRET_KEY")
    expect(plan.blanked).not.toContain("HARMLESS")
  })

  it("the well-known names are always blanked, even when nothing defines them", () => {
    const plan = planBuild({}, [])
    for (const key of ISOLATED_ENV_KEYS) expect(plan.env[key], key).toBe("")
  })

  it("the flag value must be exactly 1 — anything else is still isolated", () => {
    for (const v of ["0", "true", "yes", ""]) {
      expect(planBuild({ [ALLOW_DB_FLAG]: v, DATABASE_URL: PROD }, []).mode, v).toBe("isolated")
    }
  })

  it("collectDatastoreKeys is sorted and de-duplicated", () => {
    const keys = collectDatastoreKeys({ DATABASE_URL: PROD }, [fileEnv, { DATABASE_URL: PROD }])
    expect(keys).toEqual([...new Set(keys)].sort())
  })
})

describe("planBuild — AFFISELL_BUILD_ALLOW_DB=1 keeps a NON-production database, never production", () => {
  it("keeps the PostgreSQL URLs when none of them is production — but never a cache credential", () => {
    const plan = planBuild(
      { [ALLOW_DB_FLAG]: "1", DATABASE_URL: STAGING, UPSTASH_REDIS_REST_URL: REDIS, SOME_REDIS: "rediss://default:p@host:6379" },
      [{ DATABASE_URL_STAGING: STAGING, UPSTASH_REDIS_REST_TOKEN: "tok" }]
    )
    expect(plan.mode).toBe("allow-db")
    expect(plan.env.DATABASE_URL).toBe(STAGING)
    expect(plan.env.DATABASE_URL_STAGING).toBeUndefined() // not defined by the process, so left to the file: not production
    for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "REDIS_URL", "SOME_REDIS"]) {
      expect(plan.env[key], key).toBe("")
    }
    expect(plan.blanked).not.toContain("DATABASE_URL")
  })

  it("refuses when the production URL is in the process environment", () => {
    const plan = planBuild({ [ALLOW_DB_FLAG]: "1", DATABASE_URL: PROD }, [])
    expect(plan.mode).toBe("refused")
    expect(plan.production.map(([key]) => key)).toContain("DATABASE_URL")
  })

  it("refuses when the production URL would only be loaded from an .env file", () => {
    const plan = planBuild({ [ALLOW_DB_FLAG]: "1" }, [{ DATABASE_URL: PROD }])
    expect(plan.mode).toBe("refused")
  })

  it("judges by the EFFECTIVE value, as Next does: an explicit variable beats the file, so a production URL it overrides is harmless", () => {
    const overridden = planBuild(
      { [ALLOW_DB_FLAG]: "1", DATABASE_URL: STAGING, DIRECT_URL: STAGING },
      [{ DATABASE_URL: PROD, DIRECT_URL: PROD }]
    )
    expect(overridden.mode).toBe("allow-db")
    // …but one that is NOT overridden still counts, even though another variable is
    const notOverridden = planBuild({ [ALLOW_DB_FLAG]: "1", DATABASE_URL: STAGING }, [{ DATABASE_URL: PROD, DIRECT_URL: PROD }])
    expect(notOverridden.mode).toBe("refused")
    expect(notOverridden.production.map(([key]) => key)).toEqual(["DIRECT_URL"])
    // an EMPTY explicit variable also overrides the file
    expect(planBuild({ [ALLOW_DB_FLAG]: "1", DATABASE_URL: "", DIRECT_URL: "" }, [{ DATABASE_URL: PROD, DIRECT_URL: PROD }]).mode).toBe("allow-db")
    // the first (most specific) file wins over a later one
    expect(planBuild({ [ALLOW_DB_FLAG]: "1" }, [{ DATABASE_URL: STAGING }, { DATABASE_URL: PROD }]).mode).toBe("allow-db")
    expect(planBuild({ [ALLOW_DB_FLAG]: "1" }, [{ DATABASE_URL: PROD }, { DATABASE_URL: STAGING }]).mode).toBe("refused")
  })

  it("finds production under any variable name", () => {
    const found = findProductionDatabaseKeys({ WHATEVER_NAME: PROD, STAGING_THING: STAGING }, [])
    expect([...found.keys()]).toEqual(["WHATEVER_NAME"])
  })

  it("never prints a password, and masks the host", () => {
    const refused = describePlan(planBuild({ [ALLOW_DB_FLAG]: "1", DATABASE_URL: PROD }, []))
    expect(refused).toMatch(/REFUSED/)
    expect(refused).not.toContain("s3cr3t-password")
    expect(refused).not.toContain("ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1")
    for (const plan of [planBuild({ VERCEL: "1" }, []), planBuild({ DATABASE_URL: PROD }, []), planBuild({ [ALLOW_DB_FLAG]: "1", DATABASE_URL: STAGING }, [])]) {
      expect(describePlan(plan)).not.toContain("s3cr3t-password")
    }
  })
})

describe("readBuildEnvFiles", () => {
  it("reads the files Next loads for `next build`, skips the missing ones", () => {
    const dir = tempDir({ ".env": "A=1\n", ".env.local": "DATABASE_URL=postgres://u:p@h/db\n" })
    const files = readBuildEnvFiles(dir)
    expect(files).toEqual([{ DATABASE_URL: "postgres://u:p@h/db" }, { A: "1" }]) // .env.local comes before .env
    expect(NEXT_BUILD_ENV_FILES).toEqual([".env.production.local", ".env.local", ".env.production", ".env"])
  })

  it("no env file at all is fine (CI)", () => {
    expect(readBuildEnvFiles(tempDir())).toEqual([])
    expect(planBuild({}, readBuildEnvFiles(tempDir())).mode).toBe("isolated")
  })
})

describe("the isolation really holds against Next's own env loader", () => {
  // Next fills a variable from `.env*` only while it is `undefined`: a variable that is defined — even empty — stays.
  // This is the load-bearing claim of the wrapper, so it is proven with Next's real loader, not assumed.
  const require = createRequire(import.meta.url)
  // The loader `next build` itself uses: `@next/env`, resolved from Next's own directory (not whichever copy is hoisted).
  const loaderPath = require.resolve("@next/env", { paths: [dirname(require.resolve("next/package.json"))] })
  const log = { info: () => undefined, error: () => undefined }

  /**
   * Next's loader remembers the environment of its FIRST call (`initialEnv`) and, on a reload, REPLACES `process.env` with
   * a copy of it. So each scenario gets a fresh copy of the module — exactly like a real `next build`, whose first call
   * sees the environment the wrapper prepared — and the original `process.env` object is put back afterwards.
   */
  function freshLoadEnvConfig(): (dir: string, dev: boolean, logger: unknown, forceReload: boolean) => unknown {
    delete require.cache[loaderPath]
    return (require(loaderPath) as { loadEnvConfig: (dir: string, dev: boolean, log: unknown, forceReload: boolean) => unknown }).loadEnvConfig
  }

  function withProcessEnv<T>(overrides: Record<string, string | undefined>, run: () => T): T {
    const original = process.env
    const saved = { ...original }
    try {
      for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined) delete original[k]
        else original[k] = v
      }
      return run()
    } finally {
      process.env = original
      for (const k of Object.keys(original)) if (!(k in saved)) delete original[k]
      for (const [k, v] of Object.entries(saved)) original[k] = v as string
      delete require.cache[loaderPath]
    }
  }

  const envFile = `DATABASE_URL=${PROD}\nUPSTASH_REDIS_REST_URL=${REDIS}\nSOME_CUSTOM_PG_LINK=postgres://u:p@somewhere/db\nHARMLESS=1\n`

  it("control: with the variables UNDEFINED, Next loads the production URL from the file", () => {
    const dir = tempDir({ ".env": envFile })
    withProcessEnv({ DATABASE_URL: undefined, UPSTASH_REDIS_REST_URL: undefined, SOME_CUSTOM_PG_LINK: undefined, HARMLESS: undefined }, () => {
      freshLoadEnvConfig()(dir, false, log, true)
      expect(process.env.DATABASE_URL).toContain("misty-sea")
      expect(process.env.HARMLESS).toBe("1")
    })
  })

  it("with the wrapper's environment, the file cannot bring any credential back", () => {
    const dir = tempDir({ ".env": envFile })
    const plan = planBuild({}, readBuildEnvFiles(dir))
    expect(plan.mode).toBe("isolated")
    withProcessEnv({ ...plan.env, HARMLESS: undefined }, () => {
      freshLoadEnvConfig()(dir, false, log, true)
      // Next may normalise an empty variable to "unset"; what matters is that the file's value did not come back.
      expect(process.env.DATABASE_URL ?? "").toBe("")
      expect(process.env.UPSTASH_REDIS_REST_URL ?? "").toBe("")
      expect(process.env.SOME_CUSTOM_PG_LINK ?? "").toBe("")
      expect(process.env.HARMLESS).toBe("1") // unrelated configuration still loads
    })
  })

  it("an empty DATABASE_URL is exactly what the app already treats as 'no database' (CI builds this way)", () => {
    const plan = planBuild({}, [])
    expect(plan.env.DATABASE_URL?.trim()).toBeFalsy()
    expect(plan.env.DATABASE_URL_STAGING?.trim()).toBeFalsy()
  })
})
