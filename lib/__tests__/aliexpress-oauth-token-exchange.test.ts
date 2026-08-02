import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI,
  exchangeAliExpressAuthorizationCode,
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

  it("exchanges authorization_code via SG oauth/token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: "access_abc",
          refresh_token: "refresh_xyz",
          expires_in: 3600,
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await exchangeAliExpressAuthorizationCode({
      code: "fresh_code",
      clientId: "534690",
      clientSecret: "secret",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tokens.access_token).toBe("access_abc")
    expect(result.tokens.refresh_token).toBe("refresh_xyz")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api-sg.aliexpress.com/oauth/token")
    expect(init.method).toBe("POST")
    const body = String(init.body)
    expect(body).toContain("grant_type=authorization_code")
    expect(body).toContain("client_id=534690")
    expect(body).toContain(
      encodeURIComponent("https://affisell-market.vercel.app/api/aliexpress/oauth/callback")
    )
  })

  it("surfaces AliExpress error body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: "invalid_grant", error_description: "code expired" }),
      })
    )

    const result = await exchangeAliExpressAuthorizationCode({
      code: "stale",
      clientId: "534690",
      clientSecret: "secret",
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/invalid_grant|code expired/)
    expect(result.body).toMatchObject({ error: "invalid_grant" })
  })
})
