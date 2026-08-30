import { describe, expect, it, afterEach } from "vitest"

import {
  findStagingDatabaseUrlFromEnv,
  getDatabaseUrl,
  loadEnv,
  resolveDatabaseUrlOptional,
  resolveStagingDatabaseUrl,
} from "@/lib/env"

describe("lib/env", () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it("getDatabaseUrl prefers DATABASE_URL", () => {
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    delete process.env.DATABASE_URL_STAGING

    expect(getDatabaseUrl()).toContain("ep-shy-wind")
  })

  it("getDatabaseUrl falls back to DATABASE_URL_STAGING", () => {
    delete process.env.DATABASE_URL
    process.env.DATABASE_URL_STAGING =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

    expect(getDatabaseUrl()).toContain("ep-shy-wind-aly4bmc7")
  })

  it("findStagingDatabaseUrlFromEnv scans STAGING-named vars", () => {
    delete process.env.DATABASE_URL
    delete process.env.DATABASE_URL_STAGING
    process.env.DATABASE__XXXX_STAGING =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

    expect(findStagingDatabaseUrlFromEnv()).toContain("ep-shy-wind")
  })

  it("throws when no database url is configured", () => {
    delete process.env.DATABASE_URL
    delete process.env.DATABASE_URL_STAGING

    expect(() => getDatabaseUrl()).toThrow(/Dona: DATABASE_URL et STAGING manquants/)
  })

  it("resolveStagingDatabaseUrl returns staging branch url", () => {
    delete process.env.DATABASE_URL
    process.env.DATABASE_URL_STAGING =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

    expect(resolveStagingDatabaseUrl()).toContain("ep-shy-wind")
  })

  it("resolveStagingDatabaseUrl uses DATABASE_URL when it points at shy-wind", () => {
    delete process.env.DATABASE_URL_STAGING
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

    expect(resolveStagingDatabaseUrl()).toContain("ep-shy-wind")
  })

  it("loadEnv is idempotent", () => {
    expect(() => {
      loadEnv()
      loadEnv()
    }).not.toThrow()
  })
})
