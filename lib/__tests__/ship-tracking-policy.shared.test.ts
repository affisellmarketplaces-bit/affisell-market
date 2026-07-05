import { describe, expect, it } from "vitest"

import {
  assertOtherCarrierAllowed,
  resolveShipTrackingPolicy,
} from "@/lib/ship-tracking-policy.shared"

describe("resolveShipTrackingPolicy", () => {
  it("allows Other when SHIP_TRACKING_STRICT=0", () => {
    expect(
      resolveShipTrackingPolicy({
        shipTrackingStrict: "0",
        nodeEnv: "production",
        afterShipApiKey: "key",
      })
    ).toEqual({ strictEnforced: false, otherCarrierAllowed: true })
  })

  it("blocks Other in production without strict override", () => {
    expect(
      resolveShipTrackingPolicy({
        nodeEnv: "production",
        afterShipApiKey: "",
      })
    ).toEqual({ strictEnforced: true, otherCarrierAllowed: false })
  })

  it("blocks Other when AfterShip API key is configured", () => {
    expect(
      resolveShipTrackingPolicy({
        nodeEnv: "development",
        afterShipApiKey: "as-key",
      })
    ).toEqual({ strictEnforced: true, otherCarrierAllowed: false })
  })

  it("allows Other in local dev without AfterShip", () => {
    expect(
      resolveShipTrackingPolicy({
        nodeEnv: "development",
        afterShipApiKey: "",
      })
    ).toEqual({ strictEnforced: false, otherCarrierAllowed: true })
  })
})

describe("assertOtherCarrierAllowed", () => {
  it("rejects Autre when strict", () => {
    const result = assertOtherCarrierAllowed("Autre", {
      strictEnforced: true,
      otherCarrierAllowed: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("other_carrier_blocked")
    }
  })

  it("allows named carriers when strict", () => {
    expect(
      assertOtherCarrierAllowed("Colissimo", {
        strictEnforced: true,
        otherCarrierAllowed: false,
      }).ok
    ).toBe(true)
  })
})
