import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  AdminCredentialsError,
  COMPROMISED_PASSWORD_SHA256,
  MIN_ADMIN_PASSWORD_LENGTH,
  readAdminCredentials,
  sha256Hex,
} from "../../medusa-backend/scripts/lib/admin-credentials.mjs"
import { assessMedusaDatabaseTarget } from "../../medusa-backend/scripts/lib/database-target-guard.mjs"
import { MIN_SESSION_SECRET_LENGTH, requiredSessionSecret } from "../../medusa-backend/src/lib/session-secrets"
import { COMPROMISED_CREDENTIALS, COMPROMISED_SHA256 } from "../../scripts/lib/compromised-credentials.mjs"
import { PATTERNS, scanText } from "../../scripts/lib/secret-scan.mjs"

/**
 * Security hardening of 2026-11-25: the Medusa admin password (and three test-account passwords) were written in this
 * public repository. Credentials now come from the environment only, are validated without ever being echoed, the
 * Medusa scripts can not reach the production database by inheritance, Medusa refuses weak session secrets, and the CI
 * secret scan refuses both the shapes and the exact published values (by hash). No compromised value appears here.
 */

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
const STRONG = "correct-horse-battery-staple-42"
const PROD_URL = "postgresql://u:not-a-real-password@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb"
const LOCAL_URL = "postgresql://medusa:medusa@localhost:5432/medusa"

const added: string[] = []
afterEach(() => {
  for (const h of added.splice(0)) COMPROMISED_SHA256.delete(h)
})

describe("admin credentials come from the environment, validated, never echoed", () => {
  it("accepts a valid e-mail and a long, unpublished password", () => {
    expect(readAdminCredentials({ MEDUSA_ADMIN_EMAIL: "ops@example.com", MEDUSA_ADMIN_PASSWORD: STRONG })).toEqual({
      email: "ops@example.com",
      password: STRONG,
    })
  })

  const cases: Array<[string, Record<string, string | undefined>]> = [
    ["email_missing", { MEDUSA_ADMIN_PASSWORD: STRONG }],
    ["email_invalid", { MEDUSA_ADMIN_EMAIL: "not-an-email", MEDUSA_ADMIN_PASSWORD: STRONG }],
    ["password_missing", { MEDUSA_ADMIN_EMAIL: "ops@example.com" }],
    ["password_whitespace", { MEDUSA_ADMIN_EMAIL: "ops@example.com", MEDUSA_ADMIN_PASSWORD: ` ${STRONG}` }],
    ["password_too_short", { MEDUSA_ADMIN_EMAIL: "ops@example.com", MEDUSA_ADMIN_PASSWORD: "Short-but-x1" }],
  ]
  for (const [code, env] of cases) {
    it(`refuses (${code}) and the message never contains the password`, () => {
      try {
        readAdminCredentials(env)
        throw new Error("expected a refusal")
      } catch (err) {
        expect(err).toBeInstanceOf(AdminCredentialsError)
        expect((err as AdminCredentialsError).code).toBe(code)
        const pw = env.MEDUSA_ADMIN_PASSWORD
        if (pw) expect((err as Error).message).not.toContain(pw.trim())
      }
    })
  }

  it("refuses a value on the compromised list (matched by hash) without naming it", () => {
    const leaked = "a-value-that-leaked-0001"
    added.push(sha256Hex(leaked))
    COMPROMISED_SHA256.add(sha256Hex(leaked))
    expect(() => readAdminCredentials({ MEDUSA_ADMIN_EMAIL: "ops@example.com", MEDUSA_ADMIN_PASSWORD: leaked })).toThrow(
      /compromised/
    )
    try {
      readAdminCredentials({ MEDUSA_ADMIN_EMAIL: "ops@example.com", MEDUSA_ADMIN_PASSWORD: leaked })
    } catch (err) {
      expect((err as Error).message).not.toContain(leaked)
    }
  })

  it("the Medusa list and the repository list are the same set, holding only SHA-256 digests", () => {
    expect(COMPROMISED_PASSWORD_SHA256).toBe(COMPROMISED_SHA256)
    expect(COMPROMISED_CREDENTIALS.length).toBeGreaterThanOrEqual(4)
    for (const c of COMPROMISED_CREDENTIALS) expect(c.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(MIN_ADMIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(16)
  })
})

describe("no credential literal is left in the scripts", () => {
  const files = [
    "medusa-backend/package.json",
    "medusa-backend/scripts/setup-auto.mjs",
    "medusa-backend/scripts/validate-tryon-sync.mjs",
    "medusa-backend/scripts/create-admin-user.mjs",
    "scripts/verify-affiliate-cga-onboarding.ts",
    "scripts/verify-privacy-gate.ts",
    "scripts/verify-supplier-cgs-onboarding.ts",
  ]
  for (const f of files) {
    it(`${f} passes the secret scan`, () => {
      expect(scanText(read(f))).toEqual([])
    })
  }

  it("user:create no longer carries an e-mail or a password", () => {
    const pkg = JSON.parse(read("medusa-backend/package.json")) as { scripts: Record<string, string> }
    expect(pkg.scripts["user:create"]).toBe("node scripts/create-admin-user.mjs")
    expect(pkg.scripts["user:create"]).not.toMatch(/-p\s|-e\s|@/)
  })

  it("the scripts read the credentials through the shared helper and guard the database target", () => {
    expect(read("medusa-backend/scripts/setup-auto.mjs")).toMatch(/requireAdminCredentials\("setup-auto"\)/)
    expect(read("medusa-backend/scripts/setup-auto.mjs")).toMatch(/assessMedusaDatabaseTarget\(/)
    expect(read("medusa-backend/scripts/validate-tryon-sync.mjs")).toMatch(/requireAdminCredentials\("validate-tryon-sync"\)/)
    expect(read("medusa-backend/scripts/validate-tryon-sync.mjs")).toMatch(/assertMedusaNotOnProduction\(/)
    expect(read("medusa-backend/scripts/with-env.mjs")).toMatch(/assessMedusaDatabaseTarget\(/)
  })

  it("the env template carries placeholders only", () => {
    const tpl = read("medusa-backend/.env.template")
    expect(tpl).toMatch(/^MEDUSA_ADMIN_PASSWORD=""$/m)
    expect(tpl).toMatch(/^JWT_SECRET=""$/m)
    expect(scanText(tpl)).toEqual([])
  })
})

describe("Medusa scripts can not reach the production database by accident", () => {
  const base = { tool: "test", parentEnvFile: {} as Record<string, string>, shellEnv: {} as Record<string, string> }

  it("a local database declared in medusa-backend/.env is accepted", () => {
    expect(
      assessMedusaDatabaseTarget({ ...base, env: { DATABASE_URL: LOCAL_URL }, medusaEnvFile: { DATABASE_URL: LOCAL_URL } })
    ).toEqual({ ok: true })
  })

  it("DATABASE_URL inherited from ../.env.local is refused, even when it is local", () => {
    const v = assessMedusaDatabaseTarget({
      ...base,
      env: { DATABASE_URL: LOCAL_URL },
      medusaEnvFile: {},
      parentEnvFile: { DATABASE_URL: LOCAL_URL },
    })
    expect(v).toMatchObject({ ok: false, code: "database_url_inherited" })
  })

  it("the production endpoint is refused, in DATABASE_URL or DATABASE_URL_PRISMA, and the message hides the URL", () => {
    for (const variable of ["DATABASE_URL", "DATABASE_URL_PRISMA"]) {
      const v = assessMedusaDatabaseTarget({
        ...base,
        env: { DATABASE_URL: LOCAL_URL, [variable]: PROD_URL },
        medusaEnvFile: { DATABASE_URL: LOCAL_URL, [variable]: PROD_URL },
      })
      expect(v).toMatchObject({ ok: false, code: "production_database" })
      if (!v.ok) {
        expect(v.reason).not.toContain("not-a-real-password")
        expect(v.reason).toContain("AFFISELL_ALLOW_PRODUCTION_WRITES=ep-misty-sea-al1ne07p")
      }
    }
  })

  it("production is allowed only when the endpoint itself is named", () => {
    const env = { DATABASE_URL: PROD_URL }
    const file = { DATABASE_URL: PROD_URL }
    expect(
      assessMedusaDatabaseTarget({ ...base, env: { ...env, AFFISELL_ALLOW_PRODUCTION_WRITES: "1" }, medusaEnvFile: file }).ok
    ).toBe(false)
    expect(
      assessMedusaDatabaseTarget({
        ...base,
        env: { ...env, AFFISELL_ALLOW_PRODUCTION_WRITES: "ep-misty-sea-al1ne07p" },
        medusaEnvFile: file,
      }).ok
    ).toBe(true)
  })
})

describe("Medusa session secrets: no 'supersecret' fallback", () => {
  it("missing, weak or short secrets stop Medusa, naming only the variable", () => {
    for (const value of [undefined, "", "supersecret", "SuperSecret", "changeme", "x".repeat(MIN_SESSION_SECRET_LENGTH - 1)]) {
      expect(() => requiredSessionSecret("JWT_SECRET", { JWT_SECRET: value })).toThrow(/JWT_SECRET must be set/)
    }
    try {
      requiredSessionSecret("COOKIE_SECRET", { COOKIE_SECRET: "y".repeat(10) })
    } catch (err) {
      expect((err as Error).message).not.toContain("y".repeat(10))
    }
  })
  it("a random 32+ character secret is used as is", () => {
    const s = "f".repeat(64)
    expect(requiredSessionSecret("COOKIE_SECRET", { COOKIE_SECRET: s })).toBe(s)
  })
  it("medusa-config.ts no longer has a literal fallback", () => {
    const cfg = read("medusa-backend/medusa-config.ts")
    expect(cfg).not.toMatch(/\?\?\s*"supersecret"/)
    expect(cfg).toMatch(/requiredSessionSecret\("JWT_SECRET"\)/)
    expect(cfg).toMatch(/requiredSessionSecret\("COOKIE_SECRET"\)/)
  })
})

describe("secret scan patterns", () => {
  it("flags provider keys and credential literals, with a masked sample", () => {
    const samples: Array<[string, string]> = [
      ["Stripe live secret key", "sk_live_" + "A".repeat(24)],
      ["Medusa secret API key", "sk_" + "a".repeat(64)],
      ["Medusa CLI password literal", "medusa user -e a@b.co -p Hunter2Hunter2"],
      ["Password assigned a literal", 'const ADMIN_PASSWORD = "Hunter2Hunter2"'],
      ["GitHub PAT", "github_pat_" + "A".repeat(50)],
    ]
    for (const [kind, text] of samples) {
      const hits = scanText(text)
      expect(hits.map((h) => h.kind)).toContain(kind)
      for (const h of hits) expect(h.sample.length).toBeLessThanOrEqual(9)
    }
  })

  it("does not flag env lookups, empty placeholders or templates", () => {
    for (const text of [
      'const PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD',
      'MEDUSA_ADMIN_PASSWORD=""',
      'const PASSWORD = "${{secret}}"',
      "medusa user -e $EMAIL -p $PASSWORD",
      "pk_" + "a".repeat(64),
    ]) {
      expect(scanText(text, { denylist: new Set() })).toEqual([])
    }
  })

  it("finds a known compromised value anywhere as a token, and withholds it", () => {
    const leaked = "Leaked-Value-123"
    const hits = scanText(`{"run": "tool --token ${leaked}"}`, { denylist: new Set([sha256Hex(leaked)]) })
    expect(hits).toEqual([{ kind: "Known compromised credential", sample: "(value withheld)" }])
  })

  it("every pattern has a name", () => {
    for (const p of PATTERNS) expect(p.name.length).toBeGreaterThan(3)
  })
})
