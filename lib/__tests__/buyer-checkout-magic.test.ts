import { beforeAll, describe, expect, it } from "vitest"

import {
  createBuyerCheckoutMagicToken,
  verifyBuyerCheckoutMagicToken,
} from "@/lib/buyer-checkout-magic"

describe("buyer-checkout-magic", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-auth-secret-for-magic-token"
  })
  it("roundtrips token with profile (no DB lookup in authorize)", () => {
    const token = createBuyerCheckoutMagicToken("user_123", {
      email: "buyer@example.com",
      name: "Buyer",
    })
    const payload = verifyBuyerCheckoutMagicToken(token)
    expect(payload).toEqual({
      userId: "user_123",
      email: "buyer@example.com",
      name: "Buyer",
    })
  })

  it("rejects tampered token", () => {
    const token = createBuyerCheckoutMagicToken("user_123", { email: "a@b.co" })
    const tampered = token.replace("user_123", "user_999")
    expect(verifyBuyerCheckoutMagicToken(tampered)).toBeNull()
  })
})
