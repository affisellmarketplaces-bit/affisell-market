import { beforeAll, describe, expect, it } from "vitest"

import {
  createBuyerCheckoutMagicToken,
  verifyBuyerCheckoutMagicToken,
} from "@/lib/buyer-checkout-magic"

describe("buyer-checkout-magic", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-auth-secret-for-magic-token"
  })
  it("roundtrips token with profile and exposes its expiry", () => {
    const token = createBuyerCheckoutMagicToken("user_123", {
      email: "buyer@example.com",
      name: "Buyer",
    })
    const payload = verifyBuyerCheckoutMagicToken(token)
    expect(payload).toEqual({
      userId: "user_123",
      email: "buyer@example.com",
      name: "Buyer",
      expiresAtMs: expect.any(Number),
    })
    expect(payload!.expiresAtMs).toBeGreaterThan(Date.now())
    expect(payload!.expiresAtMs).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000)
  })

  it("rejects tampered token", () => {
    const token = createBuyerCheckoutMagicToken("user_123", { email: "a@b.co" })
    const tampered = token.replace("user_123", "user_999")
    expect(verifyBuyerCheckoutMagicToken(tampered)).toBeNull()
  })
})
