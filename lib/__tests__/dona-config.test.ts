import { describe, expect, it, afterEach } from "vitest"

import { getEnvInfo } from "@/lib/dona/config"

describe("getEnvInfo", () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it("detects prod from misty-sea DATABASE_URL", () => {
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    delete process.env.DATABASE_URL_STAGING

    expect(getEnvInfo()).toMatchObject({
      env: "prod",
      branch: "production",
      dbHost: "ep-misty-sea-al1ne07p-pooler",
      isProd: true,
    })
  })

  it("detects staging from shy-wind DATABASE_URL", () => {
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    delete process.env.DATABASE_URL_STAGING

    expect(getEnvInfo()).toMatchObject({
      env: "staging",
      branch: "staging",
      isProd: false,
    })
  })

  it("falls back to staging when only DATABASE_URL_STAGING is set", () => {
    delete process.env.DATABASE_URL
    process.env.DATABASE_URL_STAGING =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

    expect(getEnvInfo()).toMatchObject({
      env: "staging",
      branch: "staging",
      dbHost: "ep-shy-wind-aly4bmc7",
      isProd: false,
    })
  })

  it("reads staging from alternate STAGING env key", () => {
    delete process.env.DATABASE_URL
    delete process.env.DATABASE_URL_STAGING
    process.env.DATABASE__XXXX_STAGING =
      "postgresql://u:p@ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

    expect(getEnvInfo().dbHost).toBe("ep-shy-wind-aly4bmc7")
    expect(getEnvInfo().env).toBe("staging")
  })
})
