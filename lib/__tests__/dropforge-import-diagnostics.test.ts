import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("getAliExpressApiReadyStatus", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it("reports configured when app creds exist and OAuth tokens are in DB", async () => {
    vi.stubEnv("ALIEXPRESS_APP_KEY", "534690")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "secret_test_value")
    vi.doMock("@/lib/aliexpress-token-store", () => ({
      loadAliExpressTokensFromDb: vi.fn(async () => ({
        accessToken: "access_test",
        refreshToken: "refresh_test",
        accessExpiresAt: new Date(Date.now() + 86_400_000),
        refreshExpiresAt: null,
        accountHint: "affisellmarketplaces@gmail.com",
        source: "db" as const,
      })),
    }))

    const { getAliExpressApiReadyStatus } = await import("@/lib/aliexpress-api-ready.server")
    const status = await getAliExpressApiReadyStatus()
    expect(status.configured).toBe(true)
    expect(status.tokenSource).toBe("db")
    expect(status.accountHint).toContain("@")
  })

  it("falls back to env-only sync check when tokens are in env", async () => {
    vi.stubEnv("ALIEXPRESS_APP_KEY", "534690")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "secret_test_value")
    vi.stubEnv("ALIEXPRESS_REFRESH_TOKEN", "refresh_env")
    vi.doMock("@/lib/aliexpress-token-store", () => ({
      loadAliExpressTokensFromDb: vi.fn(async () => null),
    }))

    const { getAliExpressApiReadyStatus } = await import("@/lib/aliexpress-api-ready.server")
    const status = await getAliExpressApiReadyStatus()
    expect(status.configured).toBe(true)
    expect(status.tokenSource).toBe("env")
  })
})

describe("dropForgeImportFailureHints", () => {
  beforeEach(() => {
    vi.stubEnv("ALIEXPRESS_REFRESH_TOKEN", "")
    vi.stubEnv("ALIEXPRESS_ACCESS_TOKEN", "")
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("mentions OAuth DB session when API is ready via DB", async () => {
    vi.stubEnv("ALIEXPRESS_APP_KEY", "534690")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "secret_test_value")
    vi.doMock("@/lib/aliexpress-token-store", () => ({
      loadAliExpressTokensFromDb: vi.fn(async () => ({
        accessToken: "a",
        refreshToken: "r",
        accessExpiresAt: null,
        refreshExpiresAt: null,
        accountHint: "test@affisell.com",
        source: "db" as const,
      })),
    }))

    const { dropForgeImportFailureHints } = await import("@/lib/dropforge-import-diagnostics")
    const hints = await dropForgeImportFailureHints("AliExpress")
    expect(hints.some((h) => /OAuth/i.test(h))).toBe(true)
  })
})
