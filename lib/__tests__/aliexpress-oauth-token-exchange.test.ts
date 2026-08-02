import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI,
  exchangeAliExpressAuthorizationCode,
  extractAliExpressTokenPayload,
  resolveAliExpressOAuthRedirectUri,
} from "@/lib/aliexpress-oauth-token-exchange"

describe("aliexpress-oauth-token-exchange", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("defaults redirect URI to production Vercel callback", () => {
    vi.stubEnv("ALIEXPRESS_OAUTH_REDIRECT_URI", "")
    expect(resolveAliExpressOAuthRedirectUri()).toBe(DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI)
    expect(DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI).toBe(
      "https://affisell-market.vercel.app/api/aliexpress/oauth/callback"
    )
  })

  it("unwraps gopResponseBody JSON string", () => {
    const nested = extractAliExpressTokenPayload({
      success: true,
      gopResponseBody: JSON.stringify({
        access_token: "tok_a",
        refresh_token: "tok_r",
      }),
    })
    expect(nested?.access_token).toBe("tok_a")
  })

  it("falls back from REST create to GET oauth/token when POST would 405", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      const method = (init?.method ?? "GET").toUpperCase()

      if (u.includes("/rest/auth/token/create")) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error_response: { msg: "Invalid signature" } }),
        }
      }
      if (u.includes("/rest/auth/token/get")) {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: "not_found" }),
        }
      }
      if (u.startsWith("https://api-sg.aliexpress.com/oauth/token") && method === "GET") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              access_token: "access_via_get",
              refresh_token: "refresh_via_get",
              expires_in: 3600,
            }),
        }
      }
      return {
        ok: false,
        status: 405,
        text: async () => "Method Not Allowed",
      }
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await exchangeAliExpressAuthorizationCode({
      code: "fresh_code",
      clientId: "534690",
      clientSecret: "secret",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tokens.access_token).toBe("access_via_get")
    expect(result.tokens.method).toContain("GET oauth/token")
    expect(result.attempts.some((a) => a.httpStatus === 400 || a.httpStatus === 404)).toBe(true)
  })

  it("surfaces AliExpress body text on total failure (not bare http_405)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 405,
        text: async () => "Method Not Allowed — use GET",
      })
    )

    const result = await exchangeAliExpressAuthorizationCode({
      code: "stale",
      clientId: "534690",
      clientSecret: "secret",
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/405|Method Not Allowed/i)
    expect(result.bodyText).toContain("Method Not Allowed")
    expect(result.attempts.length).toBeGreaterThan(1)
  })
})
