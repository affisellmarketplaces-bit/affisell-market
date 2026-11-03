import { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Auth.js, for real: Affisell's own `lib/auth.ts` config on the installed `next-auth` / `@auth/core`, only the
 * database and the request-scoped Next helpers are replaced. Nothing here mocks the library, so a bump of
 * `next-auth` / `@auth/core` / `@auth/prisma-adapter` that breaks sign-in, the session or the fail-closed behaviour
 * shows up here before it reaches a login page.
 */
const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  requestHeaders: { current: new Headers() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFindUnique, update: vi.fn() } } }))
vi.mock("@/lib/legal/acceptance", () => ({ computeUserLegalGateHash: async () => "legal-hash" }))
vi.mock("@/lib/ensure-store", () => ({ ensureMerchantStore: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => m.requestHeaders.current,
}))

const SECRET = "authjs-flows-test-secret-0123456789abcdef"
const ORIGIN = "http://localhost:3000"
const USER_ROW = {
  role: "CUSTOMER",
  image: null,
  name: "Buyer",
  email: "buyer@example.com",
  cguVersion: null,
  isPro: false,
  radarPlan: "free",
  growthPlan: "none",
}

async function loadAuth(secret: string | null) {
  vi.resetModules()
  vi.stubEnv("AUTH_SECRET", secret ?? "")
  vi.stubEnv("NEXTAUTH_SECRET", "")
  return {
    auth: await import("@/lib/auth"),
    magic: await import("@/lib/buyer-checkout-magic"),
  }
}

function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .filter((c) => !c.endsWith("="))
    .join("; ")
}

async function signInWithMagic(auth: Awaited<ReturnType<typeof loadAuth>>["auth"], magic: string) {
  const csrfRes = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/csrf`))
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const csrfCookie = cookieHeader(csrfRes)

  return auth.handlers.POST(
    new NextRequest(`${ORIGIN}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
      body: new URLSearchParams({ csrfToken, checkoutMagic: magic, callbackUrl: `${ORIGIN}/`, json: "true" }),
    })
  )
}

beforeEach(() => {
  m.userFindUnique.mockReset()
  m.userFindUnique.mockResolvedValue(USER_ROW)
  m.requestHeaders.current = new Headers()
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("Auth.js with Affisell's configuration", () => {
  it("exposes the credentials provider", async () => {
    const { auth } = await loadAuth(SECRET)

    const res = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/providers`))

    expect(res.status).toBe(200)
    expect(Object.keys(await res.json())).toContain("credentials")
  })

  it("signs a buyer in with a checkout magic token and serves the session", async () => {
    const { auth, magic } = await loadAuth(SECRET)
    const token = magic.createBuyerCheckoutMagicToken("user_1", { email: "buyer@example.com", name: "Buyer" })

    const signIn = await signInWithMagic(auth, token)
    const sessionCookie = cookieHeader(signIn)

    expect(sessionCookie).toContain("authjs.session-token=")

    const session = await auth.handlers.GET(
      new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie: sessionCookie } })
    )
    expect(session.status).toBe(200)
    expect(await session.json()).toMatchObject({
      user: { id: "user_1", email: "buyer@example.com", role: "CUSTOMER", isPro: false },
    })

    // the proxy reads the very same cookie with getToken
    const jwt = await getToken({
      req: new NextRequest(ORIGIN, { headers: { cookie: sessionCookie } }),
      secret: SECRET,
      secureCookie: false,
    })
    expect(jwt).toMatchObject({ sub: "user_1", role: "CUSTOMER" })
  })

  it("does not sign anyone in with a tampered magic token", async () => {
    const { auth, magic } = await loadAuth(SECRET)
    const token = magic.createBuyerCheckoutMagicToken("user_1", { email: "buyer@example.com", name: "Buyer" })
    const tampered = `${token.slice(0, -2)}xx`

    const signIn = await signInWithMagic(auth, tampered)

    expect(cookieHeader(signIn)).not.toContain("authjs.session-token=")
  })

  it("does not sign anyone in with a magic token signed for another secret", async () => {
    const { magic } = await loadAuth("another-secret-0123456789abcdefghijklmnopq")
    const foreign = magic.createBuyerCheckoutMagicToken("user_1", { email: "buyer@example.com", name: "Buyer" })
    const { auth } = await loadAuth(SECRET)

    const signIn = await signInWithMagic(auth, foreign)

    expect(cookieHeader(signIn)).not.toContain("authjs.session-token=")
  })

  it("answers 'no session' for a visitor without a cookie", async () => {
    const { auth } = await loadAuth(SECRET)

    const res = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/session`))

    expect(await res.json()).toBeNull()
  })
})

describe("security advisories fixed in next-auth beta.32 / @auth/core 0.41.3", () => {
  it("GHSA-xmf8: getToken returns null on a malformed Bearer header instead of throwing", async () => {
    const req = new NextRequest(ORIGIN, { headers: { authorization: "Bearer %E0%A4%A" } })

    await expect(getToken({ req, secret: SECRET, secureCookie: false })).resolves.toBeNull()
  })

  it("GHSA-8fpg: auth() fails CLOSED when the server configuration is broken (no secret)", async () => {
    const { auth } = await loadAuth(null)

    const session = await auth.auth()

    // used to be the error body `{ message: "There was a problem with the server configuration…" }`: truthy, so every
    // existence check (`if (!session)`) let the request through
    expect(session).toBeNull()
  })
})
