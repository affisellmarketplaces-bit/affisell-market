import { describe, expect, it } from "vitest"

import {
  assertSupplierMayRegisterTracking,
  isSupplierTrackingLocked,
} from "@/lib/order-tracking-lock.shared"

describe("isSupplierTrackingLocked", () => {
  it("locks when trackingLockedAt is set", () => {
    expect(
      isSupplierTrackingLocked({
        trackingLockedAt: "2026-07-01T00:00:00.000Z",
        trackingNumber: "AB123",
        status: "paid",
      })
    ).toBe(true)
  })

  it("locks legacy shipped rows with tracking", () => {
    expect(
      isSupplierTrackingLocked({
        trackingLockedAt: null,
        trackingNumber: "AB123",
        status: "shipped",
      })
    ).toBe(true)
  })

  it("does not lock awaiting shipment without tracking", () => {
    expect(
      isSupplierTrackingLocked({
        trackingLockedAt: null,
        trackingNumber: null,
        status: "preparing",
      })
    ).toBe(false)
  })
})

describe("assertSupplierMayRegisterTracking", () => {
  it("allows idempotent replay of same tracking number", () => {
    expect(
      assertSupplierMayRegisterTracking(
        {
          trackingLockedAt: "2026-07-01T00:00:00.000Z",
          trackingNumber: "8R12345678901",
          status: "shipped",
        },
        "8r12345678901"
      ).ok
    ).toBe(true)
  })

  it("rejects replacement when locked", () => {
    const result = assertSupplierMayRegisterTracking(
      {
        trackingLockedAt: "2026-07-01T00:00:00.000Z",
        trackingNumber: "8R12345678901",
        status: "shipped",
      },
      "1Z999AA10123456784"
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("tracking_locked")
    }
  })
})
