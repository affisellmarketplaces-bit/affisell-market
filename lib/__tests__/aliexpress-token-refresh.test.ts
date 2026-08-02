import { afterEach, describe, expect, it, vi } from "vitest"

import { expiresWithinMs } from "@/lib/aliexpress-token-store"
import { summarizeAliExpressTokens } from "@/lib/aliexpress-oauth-token-exchange"

describe("aliexpress token store helpers", () => {
  it("expiresWithinMs treats missing expiry as expired", () => {
    expect(expiresWithinMs(null, 3_600_000)).toBe(true)
    expect(expiresWithinMs(undefined, 3_600_000)).toBe(true)
  })

  it("expiresWithinMs respects 1h skew window", () => {
    const in30m = new Date(Date.now() + 30 * 60 * 1000)
    const in2h = new Date(Date.now() + 2 * 60 * 60 * 1000)
    expect(expiresWithinMs(in30m, 60 * 60 * 1000)).toBe(true)
    expect(expiresWithinMs(in2h, 60 * 60 * 1000)).toBe(false)
  })
})

describe("summarizeAliExpressTokens", () => {
  it("masks tokens to last 4 chars only", () => {
    const summary = summarizeAliExpressTokens({
      access_token: "ABCDEFGHIJKLMNOP",
      refresh_token: "QRSTUVWXYZ123456",
      expires_in: 86400,
      refresh_expires_in: 172800,
      user_id: null,
      seller_id: null,
      account: null,
      method: "test",
      raw: {},
    })
    expect(summary.access_token).toContain("…MNOP")
    expect(summary.access_token).not.toContain("ABCDEF")
    expect(summary.refresh_token).toContain("…3456")
  })
})

describe("refreshAliExpressAccessToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("refreshes via SG IOP GET and returns access_token", async () => {
    vi.stubEnv("ALIEXPRESS_APP_KEY", "534690")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "test_secret_value_here")
    vi.stubEnv("ALIEXPRESS_REFRESH_TOKEN", "refresh_abc")
    vi.stubEnv("ALIEXPRESS_ENV", "sandbox")

    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes("api-sg.aliexpress.com/rest/auth/token/refresh")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              access_token: "new_access_9999",
              refresh_token: "new_refresh_8888",
              expires_in: 86400,
            }),
        }
      }
      return { ok: false, status: 404, text: async () => "" }
    })
    vi.stubGlobal("fetch", fetchMock)

    const { refreshAliExpressAccessToken, clearAliExpressTokenMemoryCache } = await import(
      "@/lib/aliexpress-oauth"
    )
    clearAliExpressTokenMemoryCache()

    const result = await refreshAliExpressAccessToken({
      refreshToken: "refresh_abc",
      appKey: "534690",
      appSecret: "test_secret_value_here",
    })

    expect(result.accessToken).toBe("new_access_9999")
    expect(result.refreshToken).toBe("new_refresh_8888")
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api-sg.aliexpress.com")
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("+")
  })
})
