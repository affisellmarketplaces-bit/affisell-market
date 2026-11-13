import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ENV_REQUIREMENTS,
  envReportLogFields,
  resetStartupEnvValidationForTests,
  runStartupEnvValidation,
  validateEnvironment,
} from "@/lib/env-validation"

const PROD_DB = "postgresql://u:p@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb"
const STAGING_DB = "postgresql://u:p@ep-shy-wind-aly4bmc7-pooler.c-3.eu-central-1.aws.neon.tech/neondb"
const LONG = "x".repeat(40)

/** A complete, valid production environment (obviously fake values). */
function productionEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    VERCEL: "1",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
    AUTH_SECRET: "a".repeat(40),
    DATABASE_URL: PROD_DB,
    DATABASE_URL_UNPOOLED: PROD_DB.replace("-pooler", ""),
    CRON_SECRET: "c".repeat(40),
    STRIPE_SECRET_KEY: "sk_" + "live_" + "FAKEFAKEFAKEFAKE0000",
    STRIPE_WEBHOOK_SECRET: "whsec_" + "w".repeat(30),
    ENCRYPTION_KEY: "e".repeat(64),
    NEXT_PUBLIC_APP_URL: "https://example.test",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    REDIS_URL: "rediss://redis.example.test",
    SENTRY_DSN: "https://k@sentry.example.test/1",
    R2_ACCESS_KEY_ID: "r2",
    RESEND_API_KEY: "re_fake",
    ...overrides,
  }
}

const ids = (env: Record<string, string | undefined>) => validateEnvironment(env).findings.map((f) => f.id)

describe("validateEnvironment — production", () => {
  it("a complete production environment has no finding at all", () => {
    const report = validateEnvironment(productionEnv())
    expect(report.findings).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.environment).toBe("production")
  })

  it.each([
    ["auth_secret_missing", { AUTH_SECRET: undefined }],
    ["database_url_missing", { DATABASE_URL: undefined }],
    ["cron_secret_missing", { CRON_SECRET: undefined }],
    ["stripe_secret_key_missing", { STRIPE_SECRET_KEY: undefined }],
    ["stripe_webhook_secret_missing", { STRIPE_WEBHOOK_SECRET: undefined }],
    ["encryption_key_missing", { ENCRYPTION_KEY: undefined }],
  ])("%s is CRITICAL (the report is not ok)", (id, override) => {
    const report = validateEnvironment(productionEnv(override))
    const finding = report.findings.find((f) => f.id === id)
    expect(finding?.severity).toBe("critical")
    expect(report.ok).toBe(false)
  })

  it("treats an empty or blank value as missing", () => {
    expect(ids(productionEnv({ CRON_SECRET: "" }))).toContain("cron_secret_missing")
    expect(ids(productionEnv({ CRON_SECRET: "   " }))).toContain("cron_secret_missing")
  })

  it("accepts either name of an alternative (AUTH_SECRET / NEXTAUTH_SECRET, like Auth.js; the encryption-key alias)", () => {
    expect(ids(productionEnv({ AUTH_SECRET: undefined, NEXTAUTH_SECRET: LONG }))).not.toContain("auth_secret_missing")
    expect(ids(productionEnv({ AUTH_SECRET: "", NEXTAUTH_SECRET: LONG }))).not.toContain("auth_secret_missing")
    expect(ids(productionEnv({ ENCRYPTION_KEY: undefined, TIKTOK_TOKEN_ENCRYPTION_KEY: LONG }))).not.toContain("encryption_key_missing")
  })

  it("missing optional integrations are WARNINGS, not critical (the app serves; a feature is off)", () => {
    const report = validateEnvironment(
      productionEnv({ UPSTASH_REDIS_REST_URL: undefined, REDIS_URL: undefined, SENTRY_DSN: undefined, RESEND_API_KEY: undefined })
    )
    expect(report.ok).toBe(true)
    expect(report.findings.map((f) => f.severity)).toEqual(["warning", "warning", "warning", "warning"])
  })

  it("flags malformed values by NAME: non-postgres DATABASE_URL, an encryption key under 32 characters, a bad payout key", () => {
    expect(ids(productionEnv({ DATABASE_URL: "mysql://x" }))).toContain("database_url_not_postgres")
    expect(ids(productionEnv({ ENCRYPTION_KEY: "short" }))).toContain("encryption_key_too_short")
    expect(ids(productionEnv({ PAYOUT_ENCRYPTION_KEY: "not-hex" }))).toContain("payout_encryption_key_invalid")
    expect(ids(productionEnv({ PAYOUT_ENCRYPTION_KEY: "ab".repeat(32) }))).not.toContain("payout_encryption_key_invalid")
  })

  it("warns about short secrets and about a CRON_SECRET reused as another secret (master O-3)", () => {
    expect(ids(productionEnv({ CRON_SECRET: "tiny" }))).toContain("secret_too_short")
    const reused = validateEnvironment(productionEnv({ CRON_SECRET: "a".repeat(40) })) // same as AUTH_SECRET
    const finding = reused.findings.find((f) => f.id === "cron_secret_reused")
    expect(finding?.variables).toEqual(["CRON_SECRET", "AUTH_SECRET"])
  })

  it("flags a production deployment that points at staging or a local database", () => {
    expect(ids(productionEnv({ DATABASE_URL: STAGING_DB }))).toContain("production_points_at_non_production_database")
    expect(ids(productionEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/db" }))).toContain("production_points_at_non_production_database")
  })

  it("notes a Stripe TEST key in production (expected only before launch) and an enabled auto-buy", () => {
    const report = validateEnvironment(productionEnv({ STRIPE_SECRET_KEY: "sk_" + "test_" + "FAKEFAKEFAKE0000", AUTO_BUY_ENABLED: "true" }))
    expect(report.findings.find((f) => f.id === "stripe_test_key_in_production")?.severity).toBe("warning")
    expect(report.findings.find((f) => f.id === "auto_buy_enabled")?.severity).toBe("warning")
    expect(report.ok).toBe(true)
    expect(ids(productionEnv({ AUTO_BUY_ENABLED: "false" }))).not.toContain("auto_buy_enabled")
  })
})

describe("validateEnvironment — preview, development, test", () => {
  const preview = (overrides: Record<string, string | undefined> = {}) => ({
    VERCEL: "1",
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
    AUTH_SECRET: LONG,
    DATABASE_URL: STAGING_DB,
    NEXT_PUBLIC_APP_URL: "https://preview.example.test",
    ...overrides,
  })

  it("a Preview needs the core (session secret, database) but not production's payment / cron / encryption secrets", () => {
    const report = validateEnvironment(preview())
    expect(report.environment).toBe("preview")
    expect(report.findings).toEqual([])
    expect(ids(preview({ AUTH_SECRET: undefined }))).toContain("auth_secret_missing")
    expect(ids(preview({ DATABASE_URL: undefined }))).toContain("database_url_missing")
  })

  it("CRITICAL: a Preview whose database variable names production — each variable is named, none of its value", () => {
    for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL", "RADAR_DATABASE_URL", "MARKET_INTELLI_DATABASE_URL"]) {
      const report = validateEnvironment(preview({ [name]: PROD_DB }))
      const finding = report.findings.find((f) => f.id === "preview_points_at_production_database")
      expect(finding?.variables, name).toEqual([name])
      expect(report.ok, name).toBe(false)
    }
  })

  it("CRITICAL: a LIVE Stripe key on a Preview (the Stripe client also refuses it); a live publishable key warns", () => {
    const report = validateEnvironment(
      preview({ STRIPE_SECRET_KEY: "sk_" + "live_" + "FAKEFAKE0000", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_" + "live_" + "FAKE" })
    )
    expect(report.findings.find((f) => f.id === "stripe_live_key_outside_production")?.severity).toBe("critical")
    expect(report.findings.find((f) => f.id === "stripe_live_publishable_key_outside_production")?.severity).toBe("warning")
    expect(report.ok).toBe(false)
  })

  it("an AFFISELL_REDIS_NAMESPACE pinned to production on a Vercel Preview is flagged (and ignored by the code); on a worker host it is legitimate", () => {
    expect(ids(preview({ AFFISELL_REDIS_NAMESPACE: "production" }))).toContain("redis_namespace_production_outside_production")
    expect(ids({ NODE_ENV: "development", AFFISELL_REDIS_NAMESPACE: "production" })).not.toContain("redis_namespace_production_outside_production")
  })

  it("development and test require nothing", () => {
    expect(validateEnvironment({ NODE_ENV: "development" }).findings).toEqual([])
    expect(validateEnvironment({ NODE_ENV: "test" }).findings).toEqual([])
    expect(validateEnvironment({ NODE_ENV: "test" }).ok).toBe(true)
  })
})

describe("names only — a value NEVER appears in a finding, a report or a log line", () => {
  // Distinctive sentinels: if any of them is found in what the validator produces, a value leaked.
  const SENTINELS = {
    AUTH_SECRET: "SENTINEL_AUTH_aaaaaaaaaaaaaaaaaaaaaaaa",
    CRON_SECRET: "SENTINEL_CRON_aaaaaaaaaaaaaaaaaaaaaaaa", // reused below to trigger cron_secret_reused
    STRIPE_SECRET_KEY: "sk_" + "live_" + "SENTINEL_STRIPE_aaaaaaaaaaaa",
    STRIPE_WEBHOOK_SECRET: "SENTINEL_WHSEC_aaaaaaaaaaaaaaaaaaaaaa",
    ENCRYPTION_KEY: "SENTINEL_ENC_short",
    PAYOUT_ENCRYPTION_KEY: "SENTINEL_PAYOUT_not_hex",
    DATABASE_URL: "postgresql://SENTINEL_USER:SENTINEL_PASSWORD@ep-misty-sea-zzzzzzzz.c-3.eu-central-1.aws.neon.tech/SENTINEL_DB",
    RADAR_DATABASE_URL: "postgresql://SENTINEL_RADAR_USER:SENTINEL_RADAR_PW@ep-misty-sea-zzzzzzzz.c-3.eu-central-1.aws.neon.tech/db",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_" + "live_" + "SENTINEL_PK_aaaaaaaa",
  }

  beforeEach(() => {
    resetStartupEnvValidationForTests()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function everything(env: Record<string, string | undefined>): string {
    const report = validateEnvironment(env)
    runStartupEnvValidation(env)
    const logged = [console.error, console.warn, console.info].flatMap((fn) => vi.mocked(fn).mock.calls)
    return JSON.stringify({ report, fields: envReportLogFields(report), logged })
  }

  it.each(["production", "preview"] as const)("in %s, whatever is wrong", (vercelEnv) => {
    const env = { VERCEL: "1", VERCEL_ENV: vercelEnv, NODE_ENV: "production", ...SENTINELS, CRON_SECRET: SENTINELS.AUTH_SECRET }
    const out = everything(env)
    expect(out).not.toMatch(/SENTINEL/)
    expect(out).not.toMatch(/sk_live|pk_live|postgresql:\/\//)
    // …while the NAMES are there, which is the point
    expect(out).toContain("DATABASE_URL")
  })

  it("the messages of every requirement are static text without any interpolation point", () => {
    for (const requirement of ENV_REQUIREMENTS) {
      expect(requirement.message).not.toMatch(/\$\{|%s/)
      expect(requirement.anyOf.length).toBeGreaterThan(0)
    }
  })
})

describe("runStartupEnvValidation", () => {
  beforeEach(() => {
    resetStartupEnvValidationForTests()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("logs ONE structured error line for a critical finding, with names and static messages", () => {
    const report = runStartupEnvValidation(productionEnv({ STRIPE_WEBHOOK_SECRET: undefined, AUTH_SECRET: undefined }))
    expect(report?.ok).toBe(false)
    expect(console.error).toHaveBeenCalledTimes(1)
    const [tag, fields] = vi.mocked(console.error).mock.calls[0] as [string, { result: string; critical: string[]; variables: string[] }]
    expect(tag).toBe("[env-validation]")
    expect(fields.result).toBe("critical")
    expect(fields.critical).toEqual(expect.arrayContaining(["auth_secret_missing", "stripe_webhook_secret_missing"]))
    expect(fields.variables).toEqual(expect.arrayContaining(["AUTH_SECRET", "NEXTAUTH_SECRET", "STRIPE_WEBHOOK_SECRET"]))
  })

  it("logs a warning for warnings only, and one info line when clean", () => {
    runStartupEnvValidation(productionEnv({ SENTRY_DSN: undefined }))
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalled()

    resetStartupEnvValidationForTests()
    vi.mocked(console.warn).mockClear()
    runStartupEnvValidation(productionEnv())
    expect(console.info).toHaveBeenCalledTimes(1)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it("does NOTHING during `next build` (the build's environment is not the runtime's; the build must stay free of side effects)", () => {
    expect(runStartupEnvValidation({ ...productionEnv({ AUTH_SECRET: undefined }), NEXT_PHASE: "phase-production-build" })).toBeNull()
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.info).not.toHaveBeenCalled()
  })

  it("runs once per process", () => {
    runStartupEnvValidation(productionEnv({ AUTH_SECRET: undefined }))
    expect(runStartupEnvValidation(productionEnv({ AUTH_SECRET: undefined }))).toBeNull()
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it("never throws, whatever the environment object looks like", () => {
    const hostile = new Proxy({}, { get: () => { throw new Error("boom") } }) as Record<string, string | undefined>
    expect(() => runStartupEnvValidation(hostile)).not.toThrow()
  })
})

describe("wiring", () => {
  it("instrumentation.ts runs the validation at server start, inside a try/catch, before the Prisma warm connect", () => {
    const source = readFileSync(join(process.cwd(), "instrumentation.ts"), "utf8")
    const validation = source.indexOf("runStartupEnvValidation()") // the CALL, not the import
    expect(validation).toBeGreaterThan(0)
    expect(validation).toBeLessThan(source.indexOf("connectPrismaWithRetry"))
    expect(source.slice(source.lastIndexOf("try {", validation), validation)).toContain("try {")
    expect(source).toContain('report.environment === "production" || report.environment === "preview"') // Sentry only for deployed environments
  })

  it("lib/env-validation.ts imports nothing server-only, no Prisma and does not read the filesystem (safe in any runtime, free of side effects at import)", () => {
    const source = readFileSync(join(process.cwd(), "lib/env-validation.ts"), "utf8")
    const imports = [...source.matchAll(/^import[^\n]*?from "([^"]+)"/gm)].map((m) => m[1])
    expect(imports.sort()).toEqual(["@/lib/db-env", "@/lib/runtime-environment", "@/lib/stripe-key-guard"])
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "") // comments excluded
    expect(code).not.toMatch(/readFileSync|dotenv|existsSync|fetch\(/)
    expect(code).not.toMatch(/\.env(?:\.local)?["'`]/)
  })
})
