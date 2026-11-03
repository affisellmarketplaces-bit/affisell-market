import { NextRequest } from "next/server"
import { encode } from "next-auth/jwt"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  beforeEach(() => {
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

  it("does not throw on a malformed Bearer header (the library alone does: URIError)", async () => {
    const { readProxySessionToken } = await load()

    await expect(
      readProxySessionToken(request({ authorization: "Bearer %E0%A4%A" }), SECRET, false)
    ).resolves.toBeNull()
  })

  it("stays anonymous for a Bearer header that is merely not a valid token", async () => {
    const { readProxySessionToken } = await load()

    await expect(
      readProxySessionToken(request({ authorization: "Bearer abc.def.ghi" }), SECRET, false)
    ).resolves.toBeNull()
  })

  it("logs an unreadable token, but not on every request", async () => {
    const { readProxySessionToken } = await load()
    const bad = () => readProxySessionToken(request({ authorization: "Bearer %E0%A4%A" }), SECRET, false)

    await bad()
    await bad()
    await bad()

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith("[proxy]", expect.objectContaining({ result: "session_token_unreadable" }))
  })
})
