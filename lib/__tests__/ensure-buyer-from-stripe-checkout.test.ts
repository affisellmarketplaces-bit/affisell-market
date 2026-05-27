import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/buyer-identify", () => ({
  identifyBuyerForCheckout: vi.fn(),
}))

import { identifyBuyerForCheckout } from "@/lib/buyer-identify"
import { ensureBuyerUserIdFromStripeCheckout } from "@/lib/ensure-buyer-from-stripe-checkout"

describe("ensureBuyerUserIdFromStripeCheckout", () => {
  beforeEach(() => {
    vi.mocked(identifyBuyerForCheckout).mockReset()
  })
  it("creates or resolves buyer from checkout email", async () => {
    vi.mocked(identifyBuyerForCheckout).mockResolvedValue({
      ok: true,
      userId: "user_1",
      email: "buyer@example.com",
      isNew: true,
      displayLabel: "buyer@example.com",
    })

    const id = await ensureBuyerUserIdFromStripeCheckout("buyer@example.com")
    expect(id).toBe("user_1")
    expect(identifyBuyerForCheckout).toHaveBeenCalledWith({
      channel: "email",
      email: "buyer@example.com",
    })
  })

  it("returns null for placeholder checkout email without phone", async () => {
    const id = await ensureBuyerUserIdFromStripeCheckout("unknown@checkout")
    expect(id).toBeNull()
    expect(identifyBuyerForCheckout).not.toHaveBeenCalled()
  })
})
