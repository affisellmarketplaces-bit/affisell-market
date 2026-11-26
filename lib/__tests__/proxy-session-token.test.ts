import { NextRequest } from "next/server"
import { encode } from "next-auth/jwt"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// `getToken` is the REAL library by default; a test can make it throw to exercise the safety net whatever version of
// `@auth/core` is installed (0.41.2 threw on a malformed Bearer header, 0.41.3 returns null, but any future failure
// must still end up as "anonymous").
const m = vi.hoisted(() => ({ getToken: vi.fn() }))
vi.mock("next-auth/jwt", async (importActual) => ({
  ...(await importActual<typeof import("next-auth/jwt")>()),
  getToken: m.getToken,
}))

const SECRET = "test-secret-with-enough-length-0123456789"
const COOKIE = "authjs.session-token"

async function load() {
  vi.resetModules()
  return import("@/lib/proxy-session-token")
}

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/dashboard/supplier", { headers })
}

describe("resolveAuthSecret", () => {
  it.each([
    [{ AUTH_SECRET: "a", NEXTAUTH_SECRET: "b" }, "a"],
    [{ NEXTAUTH_SECRET: "b" }, "b"],
    [{ AUTH_SECRET: "a" }, "a"],
    // the bug: `AUTH_SECRET ?? NEXTAUTH_SECRET` picked the EMPTY AUTH_SECRET and the proxy stopped guarding while
    // Auth.js (first non-empty) kept working with NEXTAUTH_SECRET
    [{ AUTH_SECRET: "", NEXTAUTH_SECRET: "b" }, "b"],
    [{ AUTH_SECRET: "   ", NEXTAUTH_SECRET: "b" }, "b"],
    [{ NEXTAUTH_SECRET: "  b  " }, "b"],
    [{ AUTH_SECRET: "", NEXTAUTH_SECRET: "" }, null],
    [{}, null],
  ])("%j → %j", async (env, expected) => {
    const { resolveAuthSecret } = await load()
    expect(resolveAuthSecret(env)).toBe(expected)
  })
})

describe("readProxySessionToken", () => {
  beforeEach(async () => {
    // the real library again before every test (restoreAllMocks in afterEach wipes the default implementation)
    const actual = await vi.importActual<typeof import("next-auth/jwt")>("next-auth/jwt")
    m.getToken.mockReset()
    m.getToken.mockImplementation(actual.getToken)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reads a real session token", async () => {
    const { readProxySessionToken } = await load()
    const jwt = await encode({ token: { sub: "user_1", role: "SUPPLIER" }, secret: SECRET, salt: COOKIE })

    const token = await readProxySessionToken(request({ cookie: `${COOKIE}=${jwt}` }), SECRET, false)

    expect(token).toMatchObject({ sub: "user_1", role: "SUPPLIER" })
  })

  it("is anonymous without a secret, whatever the request carries", async () => {
    const { readProxySessionToken } = await load()
    const jwt = await encode({ token: { sub: "user_1", role: "ADMIN" }, secret: SECRET, salt: COOKIE })

    expect(await readProxySessionToken(request({ cookie: `${COOKIE}=${jwt}` }), null, false)).toBeNull()
  })

  it("is anonymous for a token signed with another secret", async () => {
    const { readProxySessionToken } = await load()
    const jwt = await encode({ token: { sub: "user_1", role: "ADMIN" }, secret: "another-secret-0123456789abcdefghij", salt: COOKIE })

    expect(await readProxySessionToken(request({ cookie: `${COOKIE}=${jwt}` }), SECRET, false)).toBeNull()
  })

  it("is anonymous on a malformed Bearer header (@auth/core 0.41.2 threw URIError, 0.41.3 returns null)", async () => {
    const { readProxySessionToken } = await load()

    await expect(
      readProxySessionToken(request({ authorization: "Bearer %E0%A4%A" }), SECRET, false)
    ).resolves.toBeNull()
  })

  it("is anonymous when getToken throws, whatever the reason", async () => {
    const { readProxySessionToken } = await load()
    m.getToken.mockRejectedValueOnce(new URIError("URI malformed"))

    await expect(readProxySessionToken(request(), SECRET, false)).resolves.toBeNull()
  })

  it("stays anonymous for a Bearer header that is merely not a valid token", async () => {
    const { readProxySessionToken } = await load()

    await expect(
      readProxySessionToken(request({ authorization: "Bearer abc.def.ghi" }), SECRET, false)
    ).resolves.toBeNull()
  })

  it("logs an unreadable token, but not on every request", async () => {
    const { readProxySessionToken } = await load()
    m.getToken.mockRejectedValue(new URIError("URI malformed"))
    const bad = () => readProxySessionToken(request(), SECRET, false)

    await bad()
    await bad()
    await bad()

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith("[proxy]", expect.objectContaining({ result: "session_token_unreadable" }))
  })

  describe("a missing secret is a LOUD error, not a silent anonymous visitor (finalisation master J3)", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => undefined)
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-11-13T10:00:00Z"))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it("logs an ERROR naming the variables (never a value) when a request arrives with no secret", async () => {
      const { readProxySessionToken } = await load()

      await expect(readProxySessionToken(request(), null, false)).resolves.toBeNull()

      expect(console.error).toHaveBeenCalledTimes(1)
      const [tag, fields] = vi.mocked(console.error).mock.calls[0] as [string, { result: string; variables: string[]; note: string }]
      expect(tag).toBe("[proxy]")
      expect(fields.result).toBe("auth_secret_missing_on_request")
      expect(fields.variables).toEqual(["AUTH_SECRET", "NEXTAUTH_SECRET"])
    })

    it("repeats it for as long as requests keep coming — at most once a minute per instance", async () => {
      const { readProxySessionToken } = await load()
      const call = () => readProxySessionToken(request(), null, false)

      await call()
      await call()
      await call()
      expect(console.error).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(61_000)
      await call()
      expect(console.error).toHaveBeenCalledTimes(2)
    })

    it("does not log when a secret is set", async () => {
      const { readProxySessionToken } = await load()
      await readProxySessionToken(request(), SECRET, false)
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})
