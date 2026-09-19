import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { assessTestDatabaseUrl, dbEndpointOf, useTestDatabase } from "@/lib/testing/db-test-guard"

const PROD = "postgresql://u:p@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const PROD_POOLED = "postgresql://u:p@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb"
const BRANCH = "postgresql://u:p@ep-quiet-test-abc123.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

describe("db-test-guard", () => {
  it("normalises the pooler suffix", () => {
    expect(dbEndpointOf(PROD)).toBe(dbEndpointOf(PROD_POOLED))
    expect(dbEndpointOf("not a url")).toBeNull()
  })

  it("refuses a missing or malformed test URL", () => {
    expect(assessTestDatabaseUrl(undefined, [PROD]).ok).toBe(false)
    expect(assessTestDatabaseUrl("mysql://x", [PROD]).ok).toBe(false)
  })

  it("refuses production, its pooled twin, and staging", () => {
    expect(assessTestDatabaseUrl(PROD, [PROD]).ok).toBe(false)
    expect(assessTestDatabaseUrl(PROD_POOLED, [PROD]).ok).toBe(false)
    const staging = "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb"
    expect(assessTestDatabaseUrl(staging, [PROD, staging]).ok).toBe(false)
  })

  it("accepts a distinct branch endpoint", () => {
    const v = assessTestDatabaseUrl(BRANCH, [PROD, PROD_POOLED, undefined])
    expect(v.ok).toBe(true)
  })
})

describe("useTestDatabase (env files)", () => {
  const STAGING = "postgresql://u:p@ep-shy-wind-abc.c-3.eu-central-1.aws.neon.tech/neondb"
  function repo(files: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dbguard-"))
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body)
    return dir
  }
  const saved = { ...process.env }
  const restore = () => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
  }

  it("refuses staging by default, accepts it only with DB_TEST_ALLOW_STAGING=1", () => {
    const base = { ".env.local": `DATABASE_URL="${PROD}"\nDATABASE_URL_STAGING="${STAGING}"\n` }
    expect(() => useTestDatabase(repo({ ...base, ".env.test.local": `DATABASE_URL_TEST="${STAGING}"\n` }))).toThrow(/protected/)
    try {
      const ep = useTestDatabase(repo({ ...base, ".env.test.local": `DATABASE_URL_TEST="${STAGING}"\nDB_TEST_ALLOW_STAGING=1\n` }))
      expect(ep).toContain("ep-shy-wind-abc")
      expect(process.env.DATABASE_URL).toBe(STAGING)
    } finally {
      restore()
    }
  })

  it("never accepts production, even with the staging flag", () => {
    const dir = repo({
      ".env.local": `DATABASE_URL="${PROD}"\n`,
      ".env.test.local": `DATABASE_URL_TEST="${PROD_POOLED}"\nDB_TEST_ALLOW_STAGING=1\n`,
    })
    expect(() => useTestDatabase(dir)).toThrow(/protected/)
  })
})
