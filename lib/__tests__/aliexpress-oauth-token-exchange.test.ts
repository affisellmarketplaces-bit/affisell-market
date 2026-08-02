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

  it("succeeds on first IOP ms+sha256 create attempt", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      const method = (init?.method ?? "GET").toUpperCase()
      if (u.includes("/rest/auth/token/create") && method === "GET") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              access_token: "access_iop",
              refresh_token: "refresh_iop",
              expires_in: 86400,
            }),
        }
      }
      return { ok: false, status: 404, text: async () => "" }
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await exchangeAliExpressAuthorizationCode({
      code: "fresh_code",
      clientId: "534690",
      clientSecret: "secret",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tokens.access_token).toBe("access_iop")
    const firstUrl = String(fetchMock.mock.calls[0]?.[0] ?? "")
    expect(firstUrl).toContain("/rest/auth/token/create?")
    expect(firstUrl).not.toContain("+")
  })

  it("surfaces IllegalTimestamp from AE body instead of trailing oauth 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url)
        if (u.includes("/rest/auth/token")) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                type: "ISV",
                code: "IllegalTimestamp",
                message: "The timestamp is invalid or malformed",
              }),
          }
        }
        return { ok: false, status: 404, text: async () => "" }
      })
    )

    const result = await exchangeAliExpressAuthorizationCode({
      code: "stale",
      clientId: "534690",
      clientSecret: "secret",
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/IllegalTimestamp|malformed/i)
    expect(result.error).not.toBe("http_404")
    expect(result.bodyText).toContain("IllegalTimestamp")
  })
})
