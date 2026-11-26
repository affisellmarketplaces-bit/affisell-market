import bcrypt from "bcryptjs"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ACCOUNT_LOCK_PREFIX,
  SESSION_REVALIDATE_MS,
  isPasswordLocked,
  sessionAfterCheck,
  sessionRevalidationDue,
} from "@/lib/auth-account-lock"

/**
 * Neutralising an account must also end its open sessions. JWT sessions live 30 days and can not be revoked one by
 * one, so the jwt callback re-reads the account every SESSION_REVALIDATE_MS: deleted or locked (password prefixed with
 * `locked-…`) → the session cookie is cleared; a role change is applied. Real Auth.js on Affisell's lib/auth.ts, only
 * the database and the request-scoped Next helpers replaced.
 */
const db = vi.hoisted(() => ({
  row: null as null | Record<string, unknown>,
  failLookups: false,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (db.failLookups) throw new Error("db down")
        const r = db.row
        if (!r) return null
        if (where.id && where.id !== r.id) return null
        if (where.email && where.email !== r.email) return null
        return r
      }),
      count: vi.fn(async ({ where }: { where: { id: string; password: { startsWith: string } } }) => {
        if (db.failLookups) throw new Error("db down")
        const r = db.row
        if (!r || r.id !== where.id) return 0
        return typeof r.password === "string" && r.password.startsWith(where.password.startsWith) ? 1 : 0
      }),
      update: vi.fn(),
    },
    verificationToken: { create: vi.fn(), deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}))
vi.mock("@/lib/legal/acceptance", () => ({ computeUserLegalGateHash: async () => "legal-hash" }))
vi.mock("@/lib/ensure-store", () => ({ ensureMerchantStore: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}))

const ORIGIN = "http://localhost:3000"
const PASSWORD = "Tr0ub4dor-horse-77"
let HASH = ""

function cookieHeader(res: Response, prev = ""): string {
  const jar = new Map(prev.split("; ").filter(Boolean).map((c) => [c.split("=")[0]!, c] as const))
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(";")[0]!
    const name = pair.split("=")[0]!
    if (pair.endsWith("=")) jar.delete(name)
    else jar.set(name, pair)
  }
  return [...jar.values()].join("; ")
}

async function loadAuth() {
  vi.resetModules()
  vi.stubEnv("AUTH_SECRET", "auth-revalidation-test-secret-0123456789")
  vi.stubEnv("NEXTAUTH_SECRET", "")
  vi.stubEnv("AUTH_TRUST_HOST", "true")
  return import("@/lib/auth")
}

async function signIn(auth: Awaited<ReturnType<typeof loadAuth>>, callbackUrl = `${ORIGIN}/`) {
  const csrfRes = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/csrf`))
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const jar = cookieHeader(csrfRes)
  const res = await auth.handlers.POST(
    new NextRequest(`${ORIGIN}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar },
      body: new URLSearchParams({ csrfToken, email: "seller@example.com", password: PASSWORD, callbackUrl, json: "true" }),
    })
  )
  return { res, jar: cookieHeader(res, jar) }
}

async function session(auth: Awaited<ReturnType<typeof loadAuth>>, jar: string) {
  const res = await auth.handlers.GET(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie: jar } }))
  return { body: (await res.json()) as null | { user?: { role?: string } }, jar: cookieHeader(res, jar) }
}

beforeEach(async () => {
  HASH ||= await bcrypt.hash(PASSWORD, 4)
  db.failLookups = false
  db.row = {
    id: "user_1",
    email: "seller@example.com",
    password: HASH,
    role: "SUPPLIER",
    image: null,
    name: "Seller",
    cguVersion: null,
    isPro: false,
    radarPlan: "free",
    growthPlan: "none",
  }
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("lock rule (pure)", () => {
  it("recognises only the lock prefix", () => {
    expect(isPasswordLocked(`${ACCOUNT_LOCK_PREFIX}2026-11-25:$2a$10$abc`)).toBe(true)
    expect(isPasswordLocked("$2a$10$abc")).toBe(false)
    expect(isPasswordLocked(null)).toBe(false)
  })
  it("re-checks when due, missing, non-numeric or in the future", () => {
    const now = 10_000_000
    expect(sessionRevalidationDue(undefined, now).action).toBe("check")
    expect(sessionRevalidationDue("123", now).action).toBe("check")
    expect(sessionRevalidationDue(now + 10 * 60_000, now).action).toBe("check")
    expect(sessionRevalidationDue(now - SESSION_REVALIDATE_MS, now).action).toBe("check")
    expect(sessionRevalidationDue(now - SESSION_REVALIDATE_MS + 1, now).action).toBe("keep")
  })
  it("ends the session for a missing or locked account, keeps the role otherwise", () => {
    expect(sessionAfterCheck({ exists: false })).toEqual({ end: true })
    expect(sessionAfterCheck({ exists: true, locked: true, role: "ADMIN" })).toEqual({ end: true })
    expect(sessionAfterCheck({ exists: true, locked: false, role: "SUPPLIER" })).toEqual({ end: false, role: "SUPPLIER" })
  })
})

describe("real Auth.js: open sessions follow the account", { timeout: 30_000 }, () => {
  it("a locked account can not sign in (answered like a wrong password)", async () => {
    db.row!.password = `${ACCOUNT_LOCK_PREFIX}2026-11-25:${HASH}`
    const auth = await loadAuth()
    const { jar } = await signIn(auth)
    expect(jar).not.toMatch(/session-token=/)
  })

  it("an open session ends at the next revalidation once the account is locked", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"))
    const auth = await loadAuth()
    let { jar } = await signIn(auth)
    expect(jar).toMatch(/session-token=/)
    expect((await session(auth, jar)).body?.user?.role).toBe("SUPPLIER")

    db.row!.password = `${ACCOUNT_LOCK_PREFIX}2026-11-25:${HASH}`
    // Before the revalidation interval: the session still answers (bounded window, by design).
    vi.setSystemTime(new Date(Date.now() + SESSION_REVALIDATE_MS - 30_000))
    ;({ jar } = await session(auth, jar))
    expect(jar).toMatch(/session-token=/)

    vi.setSystemTime(new Date(Date.now() + SESSION_REVALIDATE_MS))
    const after = await session(auth, jar)
    expect(after.body).toBeNull()
    expect(after.jar).not.toMatch(/session-token=/)
  })

  it("a deleted account loses its session; a role change is applied", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"))
    const auth = await loadAuth()
    let { jar } = await signIn(auth)

    db.row!.role = "CUSTOMER"
    vi.setSystemTime(new Date(Date.now() + SESSION_REVALIDATE_MS + 1000))
    const s1 = await session(auth, jar)
    expect(s1.body?.user?.role).toBe("CUSTOMER")
    jar = s1.jar

    db.row = null
    vi.setSystemTime(new Date(Date.now() + SESSION_REVALIDATE_MS + 1000))
    expect((await session(auth, jar)).body).toBeNull()
  })

  it("a database error during revalidation keeps the session (logged), never ends it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"))
    const auth = await loadAuth()
    const { jar } = await signIn(auth)
    db.failLookups = true
    vi.setSystemTime(new Date(Date.now() + SESSION_REVALIDATE_MS + 1000))
    expect((await session(auth, jar)).body?.user?.role).toBe("SUPPLIER")
  })
})

describe("ADMIN_EMAIL_ALLOWLIST (lib/admin-allowlist.ts) on real Auth.js", { timeout: 30_000 }, () => {
  it("unset: the database role decides (no change)", async () => {
    db.row!.role = "ADMIN"
    const auth = await loadAuth()
    const { jar } = await signIn(auth)
    expect((await session(auth, jar)).body?.user?.role).toBe("ADMIN")
  })

  it("set without this e-mail: the session is CUSTOMER and the admin portal refuses the sign-in", async () => {
    db.row!.role = "ADMIN"
    const auth = await loadAuth()
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "ops@affisell.com")
    const { jar } = await signIn(auth)
    expect((await session(auth, jar)).body?.user?.role).toBe("CUSTOMER")
    const portal = await signIn(auth, `${ORIGIN}/admin/auto-fulfill`)
    expect(portal.jar).not.toMatch(/session-token=/)
  })

  it("set with this e-mail (any case): ADMIN", async () => {
    db.row!.role = "ADMIN"
    const auth = await loadAuth()
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", " ops@affisell.com , Seller@Example.com ")
    const { jar } = await signIn(auth)
    expect((await session(auth, jar)).body?.user?.role).toBe("ADMIN")
    expect((await signIn(auth, `${ORIGIN}/admin/auto-fulfill`)).jar).toMatch(/session-token=/)
  })

  it("an open admin session loses admin rights at the next revalidation once the e-mail leaves the list", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-26T12:00:00Z"))
    db.row!.role = "ADMIN"
    const auth = await loadAuth()
    const { jar } = await signIn(auth)
    expect((await session(auth, jar)).body?.user?.role).toBe("ADMIN")
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "ops@affisell.com")
    vi.setSystemTime(new Date(Date.now() + SESSION_REVALIDATE_MS + 1000))
    expect((await session(auth, jar)).body?.user?.role).toBe("CUSTOMER")
  })

  it("the list never grants a role", async () => {
    db.row!.role = "SUPPLIER"
    const auth = await loadAuth()
    vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "seller@example.com")
    const { jar } = await signIn(auth)
    expect((await session(auth, jar)).body?.user?.role).toBe("SUPPLIER")
  })
})
