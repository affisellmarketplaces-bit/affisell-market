import { createHash } from "node:crypto"

import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * lib/password-reset.server.ts — the token is consumed atomically with the password write, the same password rule as
 * the signup applies, and the "unknown e-mail" log line never contains the address.
 */
type TokenRow = { id: string; userId: string; tokenHash: string; expiresAt: Date }

const db = vi.hoisted(() => ({
  tokens: [] as TokenRow[],
  passwords: new Map<string, string>(),
  users: new Map<string, { id: string; email: string; name: string | null; role: string }>(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/emails/send-password-reset", () => ({ sendPasswordResetEmail: vi.fn(async () => ({ ok: true })) }))
vi.mock("@/lib/emails/send-order-confirmation", () => ({ resolveAppUrl: () => "https://affisell.test" }))
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async (p: string) => `hashed:${p}`) } }))

function tokenDelegate() {
  return {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      const row = db.tokens.find((t) => t.tokenHash === where.tokenHash)
      if (!row) return null
      const user = db.users.get(row.userId)
      return { ...row, user: user ? { email: user.email } : null }
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      db.tokens = db.tokens.filter((t) => t.id !== where.id)
    }),
    deleteMany: vi.fn(async ({ where }: { where: { id?: string; userId?: string; expiresAt?: { gte: Date } } }) => {
      const before = db.tokens.length
      db.tokens = db.tokens.filter((t) => {
        const match =
          (where.id === undefined || t.id === where.id) &&
          (where.userId === undefined || t.userId === where.userId) &&
          (where.expiresAt === undefined || t.expiresAt >= where.expiresAt.gte)
        return !match
      })
      return { count: before - db.tokens.length }
    }),
    create: vi.fn(async ({ data }: { data: Omit<TokenRow, "id"> }) => {
      const row = { id: `t${db.tokens.length + 1}`, ...data }
      db.tokens.push(row)
      return row
    }),
  }
}

vi.mock("@/lib/prisma", () => {
  const passwordResetToken = tokenDelegate()
  const user = {
    findFirst: vi.fn(async ({ where }: { where: { email: { equals: string } } }) => {
      return [...db.users.values()].find((u) => u.email === where.email.equals) ?? null
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { password: string } }) => {
      db.passwords.set(where.id, data.password)
    }),
  }
  const client = {
    passwordResetToken,
    user,
    // one transaction at a time, like row locks would serialise the two submissions
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)({ passwordResetToken, user })
      return Promise.all(arg as Promise<unknown>[])
    }),
  }
  return { prisma: client }
})

import { requestPasswordReset, resetPasswordWithToken } from "@/lib/password-reset.server"

const TOKEN = "a".repeat(64)
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex")

beforeEach(() => {
  db.tokens = []
  db.passwords.clear()
  db.users.clear()
  db.users.set("u1", { id: "u1", email: "jo@example.com", name: "Jo", role: "CUSTOMER" })
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

function seedToken(expiresInMs = 60_000) {
  db.tokens.push({ id: "t1", userId: "u1", tokenHash: sha(TOKEN), expiresAt: new Date(Date.now() + expiresInMs) })
}

describe("resetPasswordWithToken", () => {
  it("sets the password and consumes every token of the account", async () => {
    seedToken()
    db.tokens.push({ id: "t2", userId: "u1", tokenHash: sha("b".repeat(64)), expiresAt: new Date(Date.now() + 60_000) })

    await expect(resetPasswordWithToken(TOKEN, "Tr0ub4dor-horse-77")).resolves.toEqual({ ok: true })

    expect(db.passwords.get("u1")).toBe("hashed:Tr0ub4dor-horse-77")
    expect(db.tokens).toHaveLength(0)
  })

  it("lets only ONE of two concurrent submissions of the same link set a password", async () => {
    seedToken()

    const [a, b] = await Promise.all([
      resetPasswordWithToken(TOKEN, "Tr0ub4dor-horse-77"),
      resetPasswordWithToken(TOKEN, "Another-g00d-pass"),
    ])

    expect([a, b].filter((r) => r.ok)).toHaveLength(1)
    expect([a, b].filter((r) => !r.ok)).toEqual([{ ok: false, error: "invalid_token" }])
    expect(db.passwords.size).toBe(1)
  })

  it("refuses an expired or unknown token without writing a password", async () => {
    seedToken(-1)
    await expect(resetPasswordWithToken(TOKEN, "Tr0ub4dor-horse-77")).resolves.toEqual({ ok: false, error: "invalid_token" })
    await expect(resetPasswordWithToken("c".repeat(64), "Tr0ub4dor-horse-77")).resolves.toEqual({
      ok: false,
      error: "invalid_token",
    })
    expect(db.passwords.size).toBe(0)
  })

  it("applies the password rule (and keeps the token for a second try)", async () => {
    seedToken()

    await expect(resetPasswordWithToken(TOKEN, "short")).resolves.toEqual({ ok: false, error: "password_too_short" })
    await expect(resetPasswordWithToken(TOKEN, "password123")).resolves.toEqual({ ok: false, error: "password_too_common" })
    await expect(resetPasswordWithToken(TOKEN, "jo@example.com")).resolves.toEqual({
      ok: false,
      error: "password_matches_email",
    })
    await expect(resetPasswordWithToken(TOKEN, "x".repeat(40) + "é".repeat(20))).resolves.toEqual({
      ok: false,
      error: "password_too_long",
    })
    expect(db.passwords.size).toBe(0)
    expect(db.tokens).toHaveLength(1)
  })
})

describe("requestPasswordReset", () => {
  it("never logs the address in clear for an unknown e-mail", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

    await requestPasswordReset("someone.private@example.org")

    const printed = JSON.stringify(log.mock.calls)
    expect(printed).toContain("unknown_email")
    expect(printed).not.toContain("someone.private@example.org")
    expect(printed).not.toContain("someone.private")
  })
})
