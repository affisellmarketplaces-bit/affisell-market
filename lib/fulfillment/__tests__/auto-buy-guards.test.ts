import { afterEach, describe, expect, it, vi } from "vitest"

describe("auto-buy guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("isAutoBuyDisabled when DISABLE_AUTO_BUY=true", async () => {
    vi.stubEnv("DISABLE_AUTO_BUY", "true")
    vi.resetModules()
    const { isAutoBuyDisabled } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(true)
  }, 15_000)

  // Owner decision 2026-11-13: autonomous purchases are OPT-IN.
  it("is disabled by default (no opt-in variable)", async () => {
    vi.stubEnv("AUTO_BUY_ENABLED", "")
    vi.stubEnv("DISABLE_AUTO_BUY", "")
    vi.stubEnv("AUTO_ORDER_ENABLED", "")
    vi.resetModules()
    const { isAutoBuyDisabled } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(true)
  }, 15_000)

  it.each(["1", "yes", "TRUE", "enabled"])("an opt-in value other than the exact string \"true\" (%s) does not enable it", async (v) => {
    vi.stubEnv("AUTO_BUY_ENABLED", v)
    vi.stubEnv("DISABLE_AUTO_BUY", "")
    vi.stubEnv("AUTO_ORDER_ENABLED", "")
    vi.resetModules()
    const { isAutoBuyDisabled } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(true)
  }, 15_000)

  it("is enabled only with AUTO_BUY_ENABLED=true", async () => {
    vi.stubEnv("AUTO_BUY_ENABLED", "true")
    vi.stubEnv("DISABLE_AUTO_BUY", "")
    vi.stubEnv("AUTO_ORDER_ENABLED", "")
    vi.resetModules()
    const { isAutoBuyDisabled } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(false)
  }, 15_000)

  it("the kill switches still win over the opt-in", async () => {
    vi.stubEnv("AUTO_BUY_ENABLED", "true")
    vi.stubEnv("DISABLE_AUTO_BUY", "true")
    vi.resetModules()
    const { isAutoBuyDisabled } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(true)
    vi.stubEnv("DISABLE_AUTO_BUY", "")
    vi.stubEnv("AUTO_ORDER_ENABLED", "false")
    vi.resetModules()
    const again = await import("@/lib/fulfillment/auto-buy")
    expect(again.isAutoBuyDisabled()).toBe(true)
  }, 15_000)

  it("isAeDryRun when AE_DRY_RUN=true", async () => {
    vi.stubEnv("AE_DRY_RUN", "true")
    const { isAeDryRun } = await import("@/lib/fulfillment/ae-dry-run")
    expect(isAeDryRun()).toBe(true)
  })

  it("autoBuyCardAmountCents adds shipping and margin", async () => {
    const { autoBuyCardAmountCents } = await import("@/lib/fulfillment/stripe-issuing-card")
    expect(autoBuyCardAmountCents(500, 200)).toBe(800)
  })
})
