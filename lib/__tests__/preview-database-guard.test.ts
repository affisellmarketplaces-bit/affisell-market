import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PreviewProductionDatabaseError, assertPreviewNotOnProductionDatabase } from "@/lib/db-env"

const PROD_URL = "postgresql://user:SECRETPASSWORD@ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
// `vi.resetModules()` re-imports the classes, so instanceof would compare two different constructors: match the message instead.
const GUARD_MESSAGE = /\[env-guard\].*PRODUCTION database/
const STAGING_URL = "postgresql://user:SECRETPASSWORD@ep-shy-wind-aly4bmc7-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

describe("assertPreviewNotOnProductionDatabase (runtime guard, finalisation master K1)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("refuses a Preview whose database URL names production — for any client label", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(() => assertPreviewNotOnProductionDatabase(PROD_URL, "default")).toThrow(PreviewProductionDatabaseError)
    expect(() => assertPreviewNotOnProductionDatabase(PROD_URL, "fulfillment")).toThrow(PreviewProductionDatabaseError)
    expect(() => assertPreviewNotOnProductionDatabase(PROD_URL, "radar")).toThrow(PreviewProductionDatabaseError)
  })

  it("lets a Preview use the staging branch", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(() => assertPreviewNotOnProductionDatabase(STAGING_URL, "default")).not.toThrow()
  })

  it("is inert in production, in Vercel development and locally (production legitimately uses the production URL)", () => {
    for (const vercelEnv of ["production", "development", ""]) {
      vi.stubEnv("VERCEL_ENV", vercelEnv)
      expect(() => assertPreviewNotOnProductionDatabase(PROD_URL, "default")).not.toThrow()
    }
  })

  it("an empty URL is not this guard's business", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(() => assertPreviewNotOnProductionDatabase("", "default")).not.toThrow()
    expect(() => assertPreviewNotOnProductionDatabase(undefined, "default")).not.toThrow()
    expect(() => assertPreviewNotOnProductionDatabase(null, "default")).not.toThrow()
  })

  it("never shows the URL: no credentials, no scheme, no database name — only the masked endpoint", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    let error: unknown
    try {
      assertPreviewNotOnProductionDatabase(PROD_URL, "default")
    } catch (e) {
      error = e
    }
    const text = String((error as Error).message) + JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(text).not.toContain("SECRETPASSWORD")
    expect(text).not.toContain("user:")
    expect(text).not.toContain("postgresql://")
    expect(text).not.toContain("neondb")
    expect(text).toContain("****") // only the masked endpoint, like the existing [db] boot log
  })
})

describe("the database clients call the guard BEFORE they exist", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("lib/prisma.ts: on a Preview naming production, the first use of `prisma` throws instead of creating a client", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("DATABASE_URL", PROD_URL)
    vi.resetModules()
    const { prisma } = await import("@/lib/prisma")
    expect(() => prisma.user).toThrow(GUARD_MESSAGE)
  })

  it("lib/prisma.ts: the fulfilment client (its own direct URL) is guarded too", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("DATABASE_URL", STAGING_URL)
    vi.stubEnv("DATABASE_URL_UNPOOLED", PROD_URL.replace("-pooler", ""))
    vi.resetModules()
    const { fulfillmentPrisma } = await import("@/lib/prisma")
    expect(() => fulfillmentPrisma.user).toThrow(GUARD_MESSAGE)
  })

  it("lib/prisma.ts: a Preview on staging, and production on its own URL, still get a client (no connection is made here)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("DATABASE_URL", STAGING_URL)
    vi.resetModules()
    const preview = await import("@/lib/prisma")
    expect(() => preview.prisma.user).not.toThrow()
    await preview.resetPrismaClient()

    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("DATABASE_URL", PROD_URL)
    vi.resetModules()
    const production = await import("@/lib/prisma")
    expect(() => production.prisma.user).not.toThrow()
    await production.resetPrismaClient()
  })

  it("lib/prisma-radar.ts: the Radar client resolves its URL (RADAR_DATABASE_URL / MARKET_INTELLI_DATABASE_URL / DATABASE_URL) and is guarded", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("DATABASE_URL", STAGING_URL)
    vi.stubEnv("RADAR_DATABASE_URL", PROD_URL)
    vi.resetModules()
    const { getRadarDb } = await import("@/lib/prisma-radar")
    expect(() => getRadarDb()).toThrow(GUARD_MESSAGE)
  })

  it("lib/prisma-radar.ts: the legacy MARKET_INTELLI_DATABASE_URL and the DATABASE_URL fallback are covered as well", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("MARKET_INTELLI_DATABASE_URL", PROD_URL)
    vi.resetModules()
    const first = await import("@/lib/prisma-radar")
    expect(() => first.getRadarDb()).toThrow(GUARD_MESSAGE)

    vi.stubEnv("MARKET_INTELLI_DATABASE_URL", "")
    vi.stubEnv("DATABASE_URL", PROD_URL)
    vi.resetModules()
    const second = await import("@/lib/prisma-radar")
    expect(() => second.getRadarDb()).toThrow(GUARD_MESSAGE)
  })

  it("the guard call comes first in both client factories (a client created before the check would already be too late)", () => {
    const prisma = readFileSync(join(process.cwd(), "lib/prisma.ts"), "utf8")
    expect(prisma.indexOf("assertPreviewNotOnProductionDatabase(url, logLabel)")).toBeGreaterThan(0)
    expect(prisma.indexOf("assertPreviewNotOnProductionDatabase(url, logLabel)")).toBeLessThan(prisma.indexOf("new PrismaClient("))
    const radar = readFileSync(join(process.cwd(), "lib/prisma-radar.ts"), "utf8")
    expect(radar.indexOf('assertPreviewNotOnProductionDatabase(url, "radar")')).toBeGreaterThan(0)
    expect(radar.indexOf('assertPreviewNotOnProductionDatabase(url, "radar")')).toBeLessThan(radar.indexOf("new RadarPrismaClient("))
  })
})
