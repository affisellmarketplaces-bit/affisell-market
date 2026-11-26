import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  safeAuth: vi.fn(),
  rateLimit: vi.fn(),
  rateLimitKey: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
  retrieve: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

vi.mock("@/lib/safe-auth", () => ({ safeAuth: m.safeAuth }))
vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: m.rateLimitKey,
  rateLimitResponse: m.rateLimit,
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: m.userFindUnique, updateMany: m.userUpdateMany } },
}))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ accounts: { retrieve: m.retrieve } }),
}))
vi.mock("@/lib/stripe-webhook-observability", () => ({
  logStripeWebhookInfo: m.logInfo,
  logStripeWebhookError: m.logError,
  stripeErrorFields: (error: unknown) => ({ message: error instanceof Error ? error.message : String(error) }),
}))

import { POST } from "@/app/api/stripe/refresh-onboarding/route"

const OWN = "acct_own"

function call(body?: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/stripe/refresh-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.rateLimit.mockReturnValue(null)
  m.rateLimitKey.mockImplementation((_req: Request, userId?: string | null) => `user:${userId}`)
  m.safeAuth.mockResolvedValue({ user: { id: "u1" } })
  m.userFindUnique.mockResolvedValue({ role: "SUPPLIER", stripeAccountId: OWN })
  m.userUpdateMany.mockResolvedValue({ count: 1 })
  m.retrieve.mockResolvedValue({ capabilities: { transfers: "active", card_payments: "active" } })
})

describe("POST /api/stripe/refresh-onboarding", () => {
  it("refuses a visitor without a session and never calls Stripe or the database", async () => {
    m.safeAuth.mockResolvedValue(null)
    const res = await call({ accountId: OWN })

    expect(res.status).toBe(401)
    expect(m.retrieve).not.toHaveBeenCalled()
    expect(m.userFindUnique).not.toHaveBeenCalled()
    expect(m.userUpdateMany).not.toHaveBeenCalled()
  })

  it("is rate limited per signed-in user before anything is looked up", async () => {
    m.rateLimit.mockReturnValue(NextResponse.json({ error: "rate_limit" }, { status: 429 }))
    const res = await call({ accountId: OWN })

    expect(res.status).toBe(429)
    expect(m.rateLimitKey.mock.calls[0]![1]).toBe("u1")
    expect(m.userFindUnique).not.toHaveBeenCalled()
    expect(m.retrieve).not.toHaveBeenCalled()
  })

  it("refuses a role that cannot hold a Connect account", async () => {
    m.userFindUnique.mockResolvedValue({ role: "CUSTOMER", stripeAccountId: OWN })
    const res = await call({ accountId: OWN })

    expect(res.status).toBe(403)
    expect(m.retrieve).not.toHaveBeenCalled()
  })

  it("answers 404 when the user has no Connect account yet", async () => {
    m.userFindUnique.mockResolvedValue({ role: "SUPPLIER", stripeAccountId: null })
    const res = await call({ accountId: OWN })

    expect(res.status).toBe(404)
    expect(m.retrieve).not.toHaveBeenCalled()
  })

  it("refuses another account's id without calling Stripe", async () => {
    const res = await call({ accountId: "acct_someone_else" })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "forbidden_account" })
    expect(m.retrieve).not.toHaveBeenCalled()
    expect(m.userUpdateMany).not.toHaveBeenCalled()
  })

  it("syncs the user's own account and writes only to that user", async () => {
    const res = await call({ accountId: OWN })

    expect(res.status).toBe(200)
    expect(m.retrieve).toHaveBeenCalledWith(OWN)
    const update = m.userUpdateMany.mock.calls[0]![0]
    expect(update.where).toEqual({ id: "u1" })
    expect(update.data.stripeOnboardedAt).toBeInstanceOf(Date)
    expect(update.data.stripeCapabilities).toEqual({ transfers: "active", card_payments: "active" })
    expect(await res.json()).toEqual({
      accountId: OWN,
      transfers: "active",
      transfersActive: true,
      userUpdated: 1,
    })
  })

  it("works without a body: the account is the session user's own", async () => {
    const res = await call()

    expect(res.status).toBe(200)
    expect(m.retrieve).toHaveBeenCalledWith(OWN)
  })

  it("clears the onboarded date when Stripe says transfers are not active", async () => {
    m.retrieve.mockResolvedValue({ capabilities: { transfers: "pending" } })
    const res = await call({ accountId: OWN })

    const update = m.userUpdateMany.mock.calls[0]![0]
    expect(update.where).toEqual({ id: "u1" })
    expect(update.data.stripeOnboardedAt).toBeNull()
    expect(await res.json()).toMatchObject({ transfers: "pending", transfersActive: false, userUpdated: 0 })
  })

  it("answers 502 and writes nothing when Stripe fails", async () => {
    m.retrieve.mockRejectedValue(new Error("stripe down"))
    const res = await call({ accountId: OWN })

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: "stripe_unavailable" })
    expect(m.userUpdateMany).not.toHaveBeenCalled()
    expect(m.logError).toHaveBeenCalledTimes(1)
  })
})
