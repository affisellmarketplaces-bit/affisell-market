import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const findUnique = vi.hoisted(() => vi.fn())
const upsert = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({
  prisma: { platformOAuthCredential: { findUnique, upsert } },
  fulfillmentPrisma: { platformOAuthCredential: { upsert } },
}))
vi.mock("@/lib/crypto", () => ({
  hasEncryptionKey: () => true,
  encryptString: (s: string) => `enc(${s})`,
  decryptString: (s: string) => s.replace(/^enc\((.*)\)$/, "$1"),
}))

import { classifyAliExpressTokenError } from "@/lib/aliexpress-token-errors"

const row = (over: Record<string, unknown> = {}) => ({
  accessTokenEncrypted: "enc(access_db)",
  refreshTokenEncrypted: "enc(refresh_db)",
  accessExpiresAt: new Date(Date.now() + 20 * 3600_000),
  refreshExpiresAt: new Date(Date.now() + 25 * 24 * 3600_000),
  accountHint: null,
  ...over,
})

describe("error classification", () => {
  it("an outage is 'unavailable' — never a reconnect request", () => {
    expect(classifyAliExpressTokenError("AliExpress token store temporarily unavailable: x")).toBe("unavailable")
    expect(classifyAliExpressTokenError("AliExpress token refresh timed out")).toBe("unavailable")
    expect(classifyAliExpressTokenError("IllegalAccessToken")).toBe("expired_access")
  })
})

describe("token store: a DB outage is not 'no session'", () => {
  beforeEach(() => {
    vi.resetModules()
    findUnique.mockReset()
    upsert.mockReset()
    vi.stubEnv("ALIEXPRESS_REFRESH_TOKEN", "STALE_ENV_REFRESH")
    vi.stubEnv("ALIEXPRESS_ACCESS_TOKEN", "STALE_ENV_ACCESS")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("throws (transient) instead of falling back to stale env tokens", async () => {
    findUnique.mockRejectedValue(new Error("Can't reach database server"))
    const { loadAliExpressTokens, AliExpressTokenStoreUnavailableError } = await import("@/lib/aliexpress-token-store")
    await expect(loadAliExpressTokens()).rejects.toBeInstanceOf(AliExpressTokenStoreUnavailableError)
  })

  it("uses env only as bootstrap when the row genuinely does not exist", async () => {
    findUnique.mockResolvedValue(null)
    const { loadAliExpressTokens } = await import("@/lib/aliexpress-token-store")
    expect((await loadAliExpressTokens())?.source).toBe("env")
  })

  it("retries the read before giving up", async () => {
    findUnique.mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce(row())
    const { loadAliExpressTokens } = await import("@/lib/aliexpress-token-store")
    expect((await loadAliExpressTokens())?.accessToken).toBe("access_db")
  })

  it("persists rotated tokens even after transient write failures (retries, then direct connection)", async () => {
    upsert.mockRejectedValueOnce(new Error("e1")).mockRejectedValueOnce(new Error("e2")).mockResolvedValueOnce({})
    const { saveAliExpressTokens } = await import("@/lib/aliexpress-token-store")
    const res = await saveAliExpressTokens({ accessToken: "a", refreshToken: "r" })
    expect(res.ok).toBe(true)
    expect(upsert).toHaveBeenCalledTimes(3)
  })
})

describe("getValidAccessToken: transient trouble never invalidates the session", () => {
  beforeEach(() => {
    vi.resetModules()
    findUnique.mockReset()
    upsert.mockReset()
    vi.stubEnv("ALIEXPRESS_APP_KEY", "k")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "s")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("reuses the live access token when the refresh call times out", async () => {
    // access token still valid for 3h (inside the 8h refresh window) → a refresh is attempted and fails softly
    findUnique.mockResolvedValue(row({ accessExpiresAt: new Date(Date.now() + 3 * 3600_000) }))
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }) }))
    const { getValidAccessToken } = await import("@/lib/aliexpress-oauth")
    await expect(getValidAccessToken()).resolves.toBe("access_db")
  })

  it("adopts tokens another instance already rotated instead of declaring the session dead", async () => {
    findUnique
      .mockResolvedValueOnce(row({ accessExpiresAt: new Date(Date.now() + 3 * 3600_000) })) // initial load
      .mockResolvedValueOnce(
        row({
          accessTokenEncrypted: "enc(access_new)",
          refreshTokenEncrypted: "enc(refresh_new)",
          accessExpiresAt: new Date(Date.now() + 23 * 3600_000),
        })
      ) // re-read after the refresh was rejected
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ error_response: { message: "refresh_token invalid" } }) })))
    const { getValidAccessToken } = await import("@/lib/aliexpress-oauth")
    await expect(getValidAccessToken({ forceRefresh: true })).resolves.toBe("access_new")
  })
})

describe("the exact production failure is classified as a dead session, not an outage", () => {
  it("SG rejection wrapped by ds-sync → refresh_failed (reconnect)", () => {
    expect(
      classifyAliExpressTokenError(
        "The specified access token is invalid or expired — refresh token invalide : AliExpress refresh token rejected — did not return an access_token (x)"
      )
    ).toBe("refresh_failed")
  })
  it("a real transient refresh failure stays 'unavailable'", () => {
    expect(
      classifyAliExpressTokenError("The specified access token is invalid or expired — refresh échoué : AliExpress token refresh timed out")
    ).toBe("unavailable")
  })
  it("HTML from the global host never masks the DS host's verdict", async () => {
    vi.resetModules()
    vi.stubEnv("ALIEXPRESS_APP_KEY", "k")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "s")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("api-sg")
          ? { ok: true, status: 200, text: async () => JSON.stringify({ code: "IllegalRefreshToken", message: "invalid refresh token" }) }
          : { ok: true, status: 200, text: async () => "<html>gateway</html>" }
      )
    )
    const { refreshAliExpressAccessToken } = await import("@/lib/aliexpress-oauth")
    await expect(refreshAliExpressAccessToken({ refreshToken: "dead" })).rejects.toThrow(/refresh token rejected/i)
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
})

describe("token logging", () => {
  it("masks access/refresh tokens in logged response bodies", async () => {
    const { redactTokensForLog } = await import("@/lib/aliexpress-oauth-token-exchange")
    const out = redactTokensForLog('{"access_token":"50000201017SECRETSECRETABCD","refresh_token":"50001200f17ANOTHERSECRET1234","user_nick":"x"}')
    expect(out).not.toContain("SECRET")
    expect(out).toContain("…ABCD")
    expect(out).toContain("…1234")
    expect(out).toContain("user_nick")
  })
})
