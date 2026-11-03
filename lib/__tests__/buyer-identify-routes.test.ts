import { NextRequest, NextResponse } from "next/server"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  identifyAndEstablish: vi.fn(),
  checkout: vi.fn(),
  merge: vi.fn(),
  stripeRetrieve: vi.fn(),
  identify: vi.fn(),
  requiresSignIn: vi.fn(),
  safeAuth: vi.fn(),
}))

vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: () => "ip:test",
  rateLimitResponse: m.rateLimit,
}))
vi.mock("@/lib/buyer-identify-session", () => ({ identifyAndEstablishBuyerSession: m.identifyAndEstablish }))
vi.mock("@/lib/marketplace-checkout", () => ({ marketplaceCheckoutPOST: m.checkout }))
vi.mock("@/lib/merge-guest-cart-server", () => ({ mergeGuestCartLinesForUser: m.merge }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ checkout: { sessions: { retrieve: m.stripeRetrieve } } }),
}))
vi.mock("@/lib/buyer-identify", () => ({ identifyBuyerForCheckout: m.identify }))
vi.mock("@/lib/buyer-account-ownership.server", () => ({ buyerAccountRequiresSignIn: m.requiresSignIn }))
vi.mock("@/lib/safe-auth", () => ({ safeAuth: m.safeAuth }))

import { POST as buyerIdentifyPOST } from "@/app/api/auth/buyer-identify/route"
import { POST as checkoutIdentifiedPOST } from "@/app/api/checkout/identified/route"
import { POST as postCheckoutBuyerPOST } from "@/app/api/auth/post-checkout-buyer/route"

function jsonRequest(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const OPENED = {
  ok: true as const,
  userId: "new_1",
  email: "buyer@example.com",
  isNew: true,
  displayLabel: "buyer@example.com",
  sessionEstablished: true as const,
  requiresSignIn: false as const,
}

const REFUSED = {
  ok: true as const,
  userId: "victim_1",
  isNew: false as const,
  sessionEstablished: false as const,
  requiresSignIn: true as const,
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.rateLimit.mockReturnValue(null)
})

describe("POST /api/auth/buyer-identify", () => {
  it("answers 'sign in' without a name, an e-mail or a session when the account is protected", async () => {
    m.identifyAndEstablish.mockResolvedValue(REFUSED)
    const res = await buyerIdentifyPOST(
      jsonRequest("/api/auth/buyer-identify", { channel: "email", email: "victim@example.com" })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, isNew: false, sessionEstablished: false, requiresSignIn: true })
    expect(body).not.toHaveProperty("displayLabel")
  })

  it("still answers a normal identification", async () => {
    m.identifyAndEstablish.mockResolvedValue(OPENED)
    const res = await buyerIdentifyPOST(
      jsonRequest("/api/auth/buyer-identify", { channel: "email", email: "buyer@example.com" })
    )

    expect(await res.json()).toEqual({
      ok: true,
      isNew: true,
      displayLabel: "buyer@example.com",
      sessionEstablished: true,
    })
  })

  it("is rate limited before anything is looked up", async () => {
    m.rateLimit.mockReturnValue(NextResponse.json({ error: "rate_limit" }, { status: 429 }))
    const res = await buyerIdentifyPOST(
      jsonRequest("/api/auth/buyer-identify", { channel: "email", email: "victim@example.com" })
    )

    expect(res.status).toBe(429)
    expect(m.identifyAndEstablish).not.toHaveBeenCalled()
  })
})

describe("POST /api/checkout/identified", () => {
  const body = {
    channel: "email",
    email: "victim@example.com",
    checkout: { items: [{ productId: "p1", qty: 1 }] },
    guestCartItems: [{ productId: "p1", qty: 1 }],
  }

  beforeEach(() => {
    m.checkout.mockResolvedValue(NextResponse.json({ url: "https://checkout.stripe.test/cs_1" }))
    m.merge.mockResolvedValue(undefined)
  })

  it("pays as a guest and touches nothing of a protected account", async () => {
    m.identifyAndEstablish.mockResolvedValue(REFUSED)
    const res = await checkoutIdentifiedPOST(jsonRequest("/api/checkout/identified", body))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.test/cs_1" })
    // no buyer is attached to the checkout, and nothing is merged into the victim's cart
    expect(m.checkout).toHaveBeenCalledTimes(1)
    expect(m.checkout.mock.calls[0]![1]).toBeUndefined()
    expect(m.merge).not.toHaveBeenCalled()
  })

  it("attaches the buyer and merges the cart once a session is open", async () => {
    m.identifyAndEstablish.mockResolvedValue(OPENED)
    await checkoutIdentifiedPOST(jsonRequest("/api/checkout/identified", body))

    expect(m.checkout.mock.calls[0]![1]).toEqual({ buyerUserId: "new_1" })
    expect(m.merge).toHaveBeenCalledWith("new_1", [
      { productId: "p1", qty: 1, selectedColor: null, selectedSize: null },
    ])
  })
})

describe("POST /api/auth/post-checkout-buyer", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-auth-secret-for-post-checkout"
  })

  function paidSession(email: string) {
    return {
      id: "cs_attacker",
      payment_status: "paid",
      customer_details: { email },
      customer_email: null,
    }
  }

  function call() {
    return postCheckoutBuyerPOST(
      new NextRequest("http://localhost/api/auth/post-checkout-buyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "cs_attacker" }),
      })
    )
  }

  beforeEach(() => {
    m.safeAuth.mockResolvedValue(null)
    m.requiresSignIn.mockResolvedValue(false)
  })

  it("refuses to open the victim's account for a payer who typed the victim's e-mail on Stripe", async () => {
    m.stripeRetrieve.mockResolvedValue(paidSession("victim@example.com"))
    m.identify.mockResolvedValue({
      ok: true,
      userId: "victim_1",
      email: "victim@example.com",
      isNew: false,
      displayLabel: "Victim Name",
    })
    m.requiresSignIn.mockResolvedValue(true)

    const res = await call()

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: "sign_in_required", code: "sign_in_required" })
    expect(body).not.toHaveProperty("checkoutMagic")
    // the payer's own order must not make a blank account look like it has history
    expect(m.requiresSignIn).toHaveBeenCalledWith("victim_1", { ignoreStripeSessionId: "cs_attacker" })
  })

  it("still opens the account a first-time guest has just created by paying", async () => {
    m.stripeRetrieve.mockResolvedValue(paidSession("buyer@example.com"))
    m.identify.mockResolvedValue({
      ok: true,
      userId: "buyer_1",
      email: "buyer@example.com",
      isNew: false,
      displayLabel: "buyer@example.com",
    })
    m.requiresSignIn.mockResolvedValue(false)

    const res = await call()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, email: "buyer@example.com" })
  })

  it("opens a brand-new account without any ownership lookup", async () => {
    m.stripeRetrieve.mockResolvedValue(paidSession("fresh@example.com"))
    m.identify.mockResolvedValue({
      ok: true,
      userId: "fresh_1",
      email: "fresh@example.com",
      isNew: true,
      displayLabel: "fresh@example.com",
    })

    const res = await call()

    expect(res.status).toBe(200)
    expect(m.requiresSignIn).not.toHaveBeenCalled()
  })

  it("lets a buyer who is already signed in to that account get the token", async () => {
    m.stripeRetrieve.mockResolvedValue(paidSession("victim@example.com"))
    m.identify.mockResolvedValue({
      ok: true,
      userId: "victim_1",
      email: "victim@example.com",
      isNew: false,
      displayLabel: "Victim Name",
    })
    m.requiresSignIn.mockResolvedValue(true)
    m.safeAuth.mockResolvedValue({ user: { id: "victim_1" } })

    const res = await call()

    expect(res.status).toBe(200)
  })

  it("keeps rejecting an unpaid session", async () => {
    m.stripeRetrieve.mockResolvedValue({ ...paidSession("victim@example.com"), payment_status: "unpaid" })

    const res = await call()

    expect(res.status).toBe(400)
    expect(m.identify).not.toHaveBeenCalled()
  })
})
