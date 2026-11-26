import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  identify: vi.fn(),
  establish: vi.fn(),
  requiresSignIn: vi.fn(),
  safeAuth: vi.fn(),
}))

vi.mock("@/lib/buyer-identify", () => ({ identifyBuyerForCheckout: m.identify }))
vi.mock("@/lib/buyer-session-establish.server", () => ({ establishBuyerCheckoutSession: m.establish }))
vi.mock("@/lib/buyer-account-ownership.server", () => ({ buyerAccountRequiresSignIn: m.requiresSignIn }))
vi.mock("@/lib/safe-auth", () => ({ safeAuth: m.safeAuth }))

import { identifyAndEstablishBuyerSession } from "@/lib/buyer-identify-session"

const VICTIM = {
  ok: true as const,
  userId: "victim_1",
  email: "victim@example.com",
  isNew: false,
  displayLabel: "Victim Name",
}

describe("identifyAndEstablishBuyerSession", () => {
  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset()
    m.establish.mockResolvedValue({ ok: true })
    m.safeAuth.mockResolvedValue(null)
    m.requiresSignIn.mockResolvedValue(false)
  })

  it("opens a session for a brand-new account without looking at ownership", async () => {
    m.identify.mockResolvedValue({ ...VICTIM, userId: "new_1", isNew: true })
    const result = await identifyAndEstablishBuyerSession({ channel: "email", email: "victim@example.com" })

    expect(result).toMatchObject({ ok: true, userId: "new_1", sessionEstablished: true, requiresSignIn: false })
    expect(m.establish).toHaveBeenCalledTimes(1)
    expect(m.requiresSignIn).not.toHaveBeenCalled()
  })

  it("keeps the one-step flow for an existing but blank account", async () => {
    m.identify.mockResolvedValue(VICTIM)
    const result = await identifyAndEstablishBuyerSession({ channel: "email", email: "victim@example.com" })

    expect(m.requiresSignIn).toHaveBeenCalledWith("victim_1")
    expect(result).toMatchObject({ ok: true, sessionEstablished: true })
    expect(m.establish).toHaveBeenCalledTimes(1)
  })

  it("never opens a session on an existing account with an owner or history", async () => {
    m.identify.mockResolvedValue(VICTIM)
    m.requiresSignIn.mockResolvedValue(true)
    const result = await identifyAndEstablishBuyerSession({ channel: "email", email: "victim@example.com" })

    expect(m.establish).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      userId: "victim_1",
      isNew: false,
      sessionEstablished: false,
      requiresSignIn: true,
    })
  })

  it("does not leak the stored name or e-mail when it refuses", async () => {
    m.identify.mockResolvedValue(VICTIM)
    m.requiresSignIn.mockResolvedValue(true)
    const result = await identifyAndEstablishBuyerSession({ channel: "phone", phone: "0612345678" })

    expect(JSON.stringify(result)).not.toContain("Victim Name")
    expect(JSON.stringify(result)).not.toContain("victim@example.com")
  })

  it("lets a buyer who is already signed in to that very account through", async () => {
    m.identify.mockResolvedValue(VICTIM)
    m.requiresSignIn.mockResolvedValue(true)
    m.safeAuth.mockResolvedValue({ user: { id: "victim_1" } })
    const result = await identifyAndEstablishBuyerSession({ channel: "email", email: "victim@example.com" })

    expect(result).toMatchObject({ ok: true, sessionEstablished: true })
    expect(m.establish).toHaveBeenCalledTimes(1)
  })

  it("refuses when the browser is signed in to a DIFFERENT account", async () => {
    m.identify.mockResolvedValue(VICTIM)
    m.requiresSignIn.mockResolvedValue(true)
    m.safeAuth.mockResolvedValue({ user: { id: "someone_else" } })
    const result = await identifyAndEstablishBuyerSession({ channel: "email", email: "victim@example.com" })

    expect(result).toMatchObject({ ok: true, sessionEstablished: false, requiresSignIn: true })
    expect(m.establish).not.toHaveBeenCalled()
  })

  it("passes an identification error through without opening anything", async () => {
    m.identify.mockResolvedValue({ ok: false, error: "Adresse e-mail invalide.", status: 400 })
    const result = await identifyAndEstablishBuyerSession({ channel: "email", email: "nope" })

    expect(result).toEqual({ ok: false, error: "Adresse e-mail invalide.", status: 400 })
    expect(m.establish).not.toHaveBeenCalled()
  })

  it("fails closed when the ownership check itself fails", async () => {
    m.identify.mockResolvedValue(VICTIM)
    m.requiresSignIn.mockRejectedValue(new Error("db down"))

    await expect(
      identifyAndEstablishBuyerSession({ channel: "email", email: "victim@example.com" })
    ).rejects.toThrow("db down")
    expect(m.establish).not.toHaveBeenCalled()
  })
})
