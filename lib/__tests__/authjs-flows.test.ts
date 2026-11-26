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
  tokenCreate: vi.fn(),
  usedTokens: new Set<string>(),
  requestHeaders: { current: new Headers() },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: m.userFindUnique, update: vi.fn() },
    // the single-use marker of checkout magic tokens (lib/buyer-checkout-magic-consume.server.ts)
    verificationToken: { create: m.tokenCreate, deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}))
vi.mock("@/lib/legal/acceptance", () => ({ computeUserLegalGateHash: async () => "legal-hash" }))
vi.mock("@/lib/ensure-store", () => ({ ensureMerchantStore: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => m.requestHeaders.current,
}))

const SECRET = "authjs-flows-test-secret-0123456789abcdef"
const ORIGIN = "http://localhost:3000"
const USER_ROW = {
  id: "user_1",
  password: null as string | null,
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

/** bcrypt (cost 4, tests only) of PASSWORD. */
const PASSWORD = "Tr0ub4dor-horse-77"
const PASSWORD_HASH = "$2b$04$MXvJSILVhf4zUw.l14j9Fu0KOImPYDtFQZb/zjZZE3FGVTOg4gzl2"
const OTHER_HASH = "$2b$10$EBYjLkjLBWt/sg2nzV4yguqjXbuPxBuJg7saNbXRcxAl/3yO/VnNm"

async function signInWithPassword(
  auth: Awaited<ReturnType<typeof loadAuth>>["auth"],
  email: string,
  password: string
) {
  const csrfRes = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/csrf`))
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const csrfCookie = cookieHeader(csrfRes)

  return auth.handlers.POST(
    new NextRequest(`${ORIGIN}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${ORIGIN}/` }),
    })
  )
}

async function readSession(auth: Awaited<ReturnType<typeof loadAuth>>["auth"], cookie: string) {
  const res = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie } }))
  return { res, body: (await res.json()) as { user?: { id?: string; role?: string } } | null }
}

/** The sign-in error code Auth.js puts in the redirect (`?error=CredentialsSignin&code=…`). */
function signInErrorCode(res: Response): string | null {
  const location = res.headers.get("location") ?? ""
  return new URL(location, ORIGIN).searchParams.get("code")
}

beforeEach(() => {
  m.userFindUnique.mockReset()
  m.userFindUnique.mockResolvedValue(USER_ROW)
  m.usedTokens.clear()
  m.tokenCreate.mockReset()
  m.tokenCreate.mockImplementation(async ({ data }: { data: { token: string } }) => {
    if (m.usedTokens.has(data.token)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    m.usedTokens.add(data.token)
    return data
  })
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

  it("accepts a checkout magic token ONCE: a replay of the same token opens no session", async () => {
    const { auth, magic } = await loadAuth(SECRET)
    const token = magic.createBuyerCheckoutMagicToken("user_1", { email: "buyer@example.com", name: "Buyer" })

    expect(cookieHeader(await signInWithMagic(auth, token))).toContain("authjs.session-token=")
    expect(cookieHeader(await signInWithMagic(auth, token))).not.toContain("authjs.session-token=")
    expect(m.tokenCreate).toHaveBeenCalledTimes(2)
  })

  it("refuses a checkout magic token when its single use cannot be recorded (fails closed)", async () => {
    const { auth, magic } = await loadAuth(SECRET)
    m.tokenCreate.mockRejectedValueOnce(new Error("connection refused"))
    const token = magic.createBuyerCheckoutMagicToken("user_1", { email: "buyer@example.com", name: "Buyer" })

    expect(cookieHeader(await signInWithMagic(auth, token))).not.toContain("authjs.session-token=")
  })

  it("refuses a checkout magic token naming an account that is not a buyer, and does not burn it", async () => {
    const { auth, magic } = await loadAuth(SECRET)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, role: "ADMIN" })
    const token = magic.createBuyerCheckoutMagicToken("user_1", { email: "buyer@example.com", name: "Buyer" })

    expect(cookieHeader(await signInWithMagic(auth, token))).not.toContain("authjs.session-token=")
    expect(m.tokenCreate).not.toHaveBeenCalled()
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

describe("password sign-in: no account enumeration, per-address throttle", () => {
  it("gives the SAME answer for an unknown e-mail, an account without a password and a wrong password", async () => {
    const { auth } = await loadAuth(SECRET)

    m.userFindUnique.mockResolvedValue(null)
    const unknown = await signInWithPassword(auth, "nobody@example.com", PASSWORD)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, password: null })
    const oauthOnly = await signInWithPassword(auth, "buyer@example.com", PASSWORD)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, password: PASSWORD_HASH })
    const wrong = await signInWithPassword(auth, "buyer@example.com", "not-the-password-1")

    for (const res of [unknown, oauthOnly, wrong]) {
      expect(cookieHeader(res)).not.toContain("authjs.session-token=")
      expect(signInErrorCode(res)).toBe("invalid_credentials")
    }
  })

  it("signs in with the right password", async () => {
    const { auth } = await loadAuth(SECRET)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, password: PASSWORD_HASH })

    const res = await signInWithPassword(auth, "buyer@example.com", PASSWORD)

    expect(cookieHeader(res)).toContain("authjs.session-token=")
  })

  it("stops after 10 attempts on one address within 15 minutes, even with the right password", async () => {
    const { auth } = await loadAuth(SECRET)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, password: PASSWORD_HASH })

    for (let i = 0; i < 10; i++) {
      expect(signInErrorCode(await signInWithPassword(auth, "buyer@example.com", `wrong-guess-${i}`))).toBe(
        "invalid_credentials"
      )
    }
    const eleventh = await signInWithPassword(auth, "buyer@example.com", PASSWORD)
    expect(signInErrorCode(eleventh)).toBe("too_many_attempts")
    expect(cookieHeader(eleventh)).not.toContain("authjs.session-token=")

    // another address is not affected
    m.userFindUnique.mockResolvedValue(null)
    expect(signInErrorCode(await signInWithPassword(auth, "other@example.com", PASSWORD))).toBe("invalid_credentials")
  })
})

describe("session revocation (lib/auth-session-revocation.ts)", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  async function signedInSession() {
    const { auth } = await loadAuth(SECRET)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, password: PASSWORD_HASH })
    const cookie = cookieHeader(await signInWithPassword(auth, "buyer@example.com", PASSWORD))
    expect(cookie).toContain("authjs.session-token=")
    return { auth, cookie }
  }

  it("keeps the session while the password is unchanged, past the re-check interval", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const { auth, cookie } = await signedInSession()

    vi.setSystemTime(Date.now() + 6 * 60 * 1000)
    const { body } = await readSession(auth, cookie)

    expect(body).toMatchObject({ user: { id: "user_1", role: "CUSTOMER" } })
  })

  it("ends the session once the password has been changed or reset", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const { auth, cookie } = await signedInSession()

    m.userFindUnique.mockResolvedValue({ ...USER_ROW, password: OTHER_HASH })
    vi.setSystemTime(Date.now() + 6 * 60 * 1000)
    const { res, body } = await readSession(auth, cookie)

    expect(body).toBeNull()
    // the cookie is cleared, not re-issued
    expect(cookieHeader(res)).not.toContain("authjs.session-token=")
  })

  it("ends the session once the account no longer exists", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const { auth, cookie } = await signedInSession()

    m.userFindUnique.mockResolvedValue(null)
    vi.setSystemTime(Date.now() + 6 * 60 * 1000)

    expect((await readSession(auth, cookie)).body).toBeNull()
  })

  it("refreshes the role from the database at the re-check (a demoted account loses its role)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const { auth } = await loadAuth(SECRET)
    m.userFindUnique.mockResolvedValue({ ...USER_ROW, role: "ADMIN", password: PASSWORD_HASH })
    const cookie = cookieHeader(await signInWithPassword(auth, "buyer@example.com", PASSWORD))
    expect((await readSession(auth, cookie)).body).toMatchObject({ user: { role: "ADMIN" } })

    m.userFindUnique.mockResolvedValue({ ...USER_ROW, role: "CUSTOMER", password: PASSWORD_HASH })
    // within the interval the token is trusted as is…
    expect((await readSession(auth, cookie)).body).toMatchObject({ user: { role: "ADMIN" } })
    // …after it, the database decides
    vi.setSystemTime(Date.now() + 6 * 60 * 1000)
    expect((await readSession(auth, cookie)).body).toMatchObject({ user: { role: "CUSTOMER" } })
  })
})
