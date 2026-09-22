import { describe, expect, it } from "vitest"

import {
  AUTO_BUY_SOURCING_CHANNELS,
  hasLiveAutoBuyIntegration,
  isAutoBuySourcingChannel,
} from "@/lib/auto-buy-sourcing-channels"

describe("auto-buy-sourcing-channels", () => {
  it("flags real sourcing/wholesale channels", () => {
    expect(isAutoBuySourcingChannel("ALIEXPRESS")).toBe(true)
    expect(isAutoBuySourcingChannel("CJ_DROPSHIPPING")).toBe(true)
    expect(isAutoBuySourcingChannel("BIGBUY")).toBe(true)
  })

  it("does not flag channels that never spend platform money on a third-party site", () => {
    expect(isAutoBuySourcingChannel("AFFISELL_NATIVE")).toBe(false)
    expect(isAutoBuySourcingChannel("BLIND_REST")).toBe(false)
    expect(isAutoBuySourcingChannel("MANUAL")).toBe(false)
  })

  it("only AliExpress and CJ Dropshipping have a real integration today — the rest are honest stubs", () => {
    const live = new Set(["ALIEXPRESS", "CJ_DROPSHIPPING"])
    for (const channel of AUTO_BUY_SOURCING_CHANNELS) {
      expect(hasLiveAutoBuyIntegration(channel)).toBe(live.has(channel))
    }
  })
})
