import { describe, expect, it } from "vitest"

import {
  getDbEnv,
  maskDbHost,
  previewPointsAtProdDb,
  resolveAffisellEnv,
  resolveNeonBranchFromHost,
} from "@/lib/db-env"

describe("db-env", () => {
  it("resolves LOCAL when no Vercel env", () => {
    expect(resolveAffisellEnv()).toBe("LOCAL")
  })

  it("masks Neon host for logs", () => {
    expect(maskDbHost("ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech")).toMatch(
      /ep-misty-sea-\*\*\*\*/
    )
  })

  it("detects production branch from misty-sea host", () => {
    expect(
      resolveNeonBranchFromHost("ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech")
    ).toBe("production")
  })

  it("detects staging branch from shy-wind host", () => {
    expect(
      resolveNeonBranchFromHost("ep-shy-wind-aly4bmc7.c-3.eu-central-1.aws.neon.tech")
    ).toBe("staging")
  })

  it("getDbEnv returns branch production for misty-sea", () => {
    const prev = process.env.DATABASE_URL
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    try {
      const info = getDbEnv()
      expect(info.branch).toBe("production")
      expect(info.isProd).toBe(true)
      expect(info.dbHost).toContain("****")
    } finally {
      process.env.DATABASE_URL = prev
    }
  })

  it("detects preview pointing at prod endpoint", () => {
    const prevVercel = process.env.VERCEL_ENV
    const prevDb = process.env.DATABASE_URL
    process.env.VERCEL_ENV = "preview"
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    try {
      expect(previewPointsAtProdDb()).toBe(true)
    } finally {
      process.env.VERCEL_ENV = prevVercel
      process.env.DATABASE_URL = prevDb
    }
  })
})

describe("flags", () => {
  it("isFlagEnabled reads NEXT_PUBLIC_FF_*", async () => {
    const prev = process.env.NEXT_PUBLIC_FF_NEW_RADAR
    process.env.NEXT_PUBLIC_FF_NEW_RADAR = "1"
    try {
      const { isFlagEnabled } = await import("@/lib/flags")
      expect(isFlagEnabled("enableNewRadar")).toBe(true)
    } finally {
      process.env.NEXT_PUBLIC_FF_NEW_RADAR = prev
    }
  })
})
