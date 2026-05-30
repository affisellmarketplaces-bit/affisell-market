import { afterEach, describe, expect, it, vi } from "vitest"

describe("auto-buy guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("isAutoBuyDisabled when DISABLE_AUTO_BUY=true", async () => {
    vi.stubEnv("DISABLE_AUTO_BUY", "true")
    const { isAutoBuyDisabled } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(true)
  })

  it("autoBuyCardAmountCents adds shipping and margin", async () => {
    const { autoBuyCardAmountCents } = await import("@/lib/fulfillment/stripe-issuing-card")
    expect(autoBuyCardAmountCents(500, 200)).toBe(800)
  })
})
