import { describe, expect, it } from "vitest"

import { assessTestDatabaseUrl, dbEndpointOf } from "@/lib/testing/db-test-guard"

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
