import { createHash } from "node:crypto"

import { beforeEach, describe, expect, it, vi } from "vitest"

/** lib/email-verification.server.ts — issue (hashed, replaces older links) and consume (single use, expiry). */
type Row = { identifier: string; token: string; expires: Date }
const m = vi.hoisted(() => ({
  tokens: [] as Row[],
  users: new Map<string, { id: string; email: string; name: string | null; emailVerified: Date | null; password: string | null }>(),
  sent: [] as Array<{ verifyUrl: string; accountEmail: string }>,
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/emails/send-order-confirmation", () => ({ resolveAppUrl: () => "https://affisell.test" }))
vi.mock("@/lib/emails/send-email-verification", () => ({
  sendEmailVerificationEmail: vi.fn(async (args: { verifyUrl: string; accountEmail: string }) => {
    m.sent.push(args)
    return { ok: true }
  }),
}))
vi.mock("@/lib/prisma", () => {
  const verificationToken = {
    deleteMany: vi.fn(async ({ where }: { where: { identifier: string; token?: string } }) => {
      const before = m.tokens.length
      m.tokens = m.tokens.filter((t) => !(t.identifier === where.identifier && (where.token === undefined || t.token === where.token)))
      return { count: before - m.tokens.length }
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      m.tokens.push(data)
      return data
    }),
    findUnique: vi.fn(async ({ where }: { where: { token: string } }) => m.tokens.find((t) => t.token === where.token) ?? null),
  }
  const user = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => m.users.get(where.id) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; emailVerified: null }; data: { emailVerified: Date } }) => {
      const u = m.users.get(where.id)
      if (!u || u.emailVerified) return { count: 0 }
      u.emailVerified = data.emailVerified
      return { count: 1 }
    }),
  }
  return {
    prisma: {
      verificationToken,
      user,
      $transaction: vi.fn(async (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)({ verificationToken, user }) : Promise.all(arg as Promise<unknown>[])
      ),
    },
  }
})

import { consumeEmailVerification, issueEmailVerification } from "@/lib/email-verification.server"

const secretFrom = (url: string) => new URL(url).searchParams.get("token")!

beforeEach(() => {
  m.tokens = []
  m.sent = []
  m.users.clear()
  m.users.set("u1", { id: "u1", email: "jo@example.com", name: "Jo", emailVerified: null, password: "hash" })
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

describe("issueEmailVerification", () => {
  it("stores only a hash of the link's secret and e-mails the link", async () => {
    await expect(issueEmailVerification({ userId: "u1" })).resolves.toEqual({ ok: true, sent: true })

    expect(m.sent).toHaveLength(1)
    const secret = secretFrom(m.sent[0]!.verifyUrl)
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(m.tokens).toHaveLength(1)
    expect(m.tokens[0]!.identifier).toBe("email-verify:u1")
    expect(m.tokens[0]!.token).not.toContain(secret)
    expect(m.tokens[0]!.token).toBe(createHash("sha256").update(`email-verify:v1:${secret}`).digest("hex"))
  })

  it("replaces an older link (only the newest works)", async () => {
    await issueEmailVerification({ userId: "u1" })
    await issueEmailVerification({ userId: "u1" })
    expect(m.tokens).toHaveLength(1)
    await expect(consumeEmailVerification(secretFrom(m.sent[0]!.verifyUrl))).resolves.toEqual({ ok: false, reason: "invalid" })
    await expect(consumeEmailVerification(secretFrom(m.sent[1]!.verifyUrl))).resolves.toEqual({ ok: true, userId: "u1" })
  })

  it("sends nothing to a verified account or an account without a password", async () => {
    m.users.get("u1")!.emailVerified = new Date()
    await expect(issueEmailVerification({ userId: "u1" })).resolves.toEqual({ ok: false, reason: "already_verified" })
    m.users.set("u2", { id: "u2", email: "g@example.com", name: null, emailVerified: null, password: null })
    await expect(issueEmailVerification({ userId: "u2" })).resolves.toEqual({ ok: false, reason: "no_password" })
    expect(m.sent).toHaveLength(0)
  })
})

describe("consumeEmailVerification", () => {
  it("verifies the address once; a second opening of the same link is refused", async () => {
    await issueEmailVerification({ userId: "u1" })
    const secret = secretFrom(m.sent[0]!.verifyUrl)

    await expect(consumeEmailVerification(secret)).resolves.toEqual({ ok: true, userId: "u1" })
    expect(m.users.get("u1")!.emailVerified).toBeInstanceOf(Date)
    await expect(consumeEmailVerification(secret)).resolves.toEqual({ ok: false, reason: "invalid" })
  })

  it("refuses an expired link without verifying, and a malformed one without a lookup", async () => {
    await issueEmailVerification({ userId: "u1" })
    m.tokens[0]!.expires = new Date(Date.now() - 1000)

    await expect(consumeEmailVerification(secretFrom(m.sent[0]!.verifyUrl))).resolves.toEqual({ ok: false, reason: "expired" })
    expect(m.users.get("u1")!.emailVerified).toBeNull()
    await expect(consumeEmailVerification("not-a-token")).resolves.toEqual({ ok: false, reason: "invalid" })
  })

  it("does not accept a token row that belongs to another purpose (e.g. a checkout-magic marker)", async () => {
    const secret = "a".repeat(64)
    m.tokens.push({
      identifier: "checkout-magic:u1",
      token: createHash("sha256").update(`email-verify:v1:${secret}`).digest("hex"),
      expires: new Date(Date.now() + 60_000),
    })
    await expect(consumeEmailVerification(secret)).resolves.toEqual({ ok: false, reason: "invalid" })
  })
})
