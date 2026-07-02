import { describe, expect, it } from "vitest"

import {
  normalizeTrackingNumber,
  validateShipTrackingFormat,
} from "@/lib/ship-tracking-validate.shared"

describe("validateShipTrackingFormat", () => {
  it("rejects garbage tracking numbers", () => {
    expect(
      validateShipTrackingFormat({ trackingCarrier: "Colissimo", trackingNumber: "abc" }).ok
    ).toBe(false)
    expect(
      validateShipTrackingFormat({ trackingCarrier: "Colissimo", trackingNumber: "12345678" }).ok
    ).toBe(false)
    expect(
      validateShipTrackingFormat({ trackingCarrier: "Colissimo", trackingNumber: "testtest12" }).ok
    ).toBe(false)
  })

  it("accepts plausible Colissimo numbers", () => {
    const res = validateShipTrackingFormat({
      trackingCarrier: "Colissimo",
      trackingNumber: "8R12345678901",
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.normalized).toBe("8R12345678901")
    }
  })

  it("accepts UPS 1Z format", () => {
    const res = validateShipTrackingFormat({
      trackingCarrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
    })
    expect(res.ok).toBe(true)
  })

  it("normalizes spaces", () => {
    expect(normalizeTrackingNumber(" 1z 999 aa 10 1234 5678 4 ")).toBe("1Z999AA10123456784")
  })
})
