import { describe, expect, it } from "vitest"

import {
  resolveAliExpressUiStatus,
  resolveBlindRestUiStatus,
} from "@/lib/supplier/supply-hub-shared"

describe("supply-hub-shared", () => {
  it("resolveAliExpressUiStatus without platform keys", () => {
    expect(
      resolveAliExpressUiStatus({ platformConfigured: false, linkedSkus: 0, autoBuySkus: 0 })
    ).toBe("roadmap")
    expect(
      resolveAliExpressUiStatus({ platformConfigured: false, linkedSkus: 2, autoBuySkus: 0 })
    ).toBe("setup")
  })

  it("resolveAliExpressUiStatus with platform keys", () => {
    expect(
      resolveAliExpressUiStatus({ platformConfigured: true, linkedSkus: 0, autoBuySkus: 0 })
    ).toBe("setup")
    expect(
      resolveAliExpressUiStatus({ platformConfigured: true, linkedSkus: 3, autoBuySkus: 1 })
    ).toBe("connected")
  })

  it("resolveBlindRestUiStatus", () => {
    expect(resolveBlindRestUiStatus({ hasRestEndpoint: false, linkedSkus: 0 })).toBe("roadmap")
    expect(resolveBlindRestUiStatus({ hasRestEndpoint: true, linkedSkus: 0 })).toBe("setup")
    expect(resolveBlindRestUiStatus({ hasRestEndpoint: true, linkedSkus: 5 })).toBe("connected")
  })
})
