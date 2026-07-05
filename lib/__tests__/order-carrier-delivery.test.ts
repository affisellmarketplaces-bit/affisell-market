import { describe, expect, it } from "vitest"

import { ORDER_DELIVERED_AT_SOURCES } from "@/lib/order-carrier-delivery"
import { shouldAutoConfirmDelivery } from "@/lib/order-payout-policy"
import { addDays } from "@/lib/order-payout-policy"

describe("ORDER_DELIVERED_AT_SOURCES", () => {
  it("includes aftership and instant product sources", () => {
    expect(ORDER_DELIVERED_AT_SOURCES).toContain("aftership_webhook")
    expect(ORDER_DELIVERED_AT_SOURCES).toContain("digital_instant")
    expect(ORDER_DELIVERED_AT_SOURCES).toContain("booking_confirmed")
  })
})

describe("shouldAutoConfirmDelivery carrier gate", () => {
  it("requires carrier deliveredAt — shippedAt alone is not enough", () => {
    const shipped = new Date("2026-01-01T12:00:00Z")
    expect(
      shouldAutoConfirmDelivery(
        { deliveredAt: null, shippedAt: shipped, deliveryConfirmedAt: null },
        addDays(shipped, 10)
      )
    ).toBe(false)
  })

  it("auto-confirms from carrier deliveredAt", () => {
    const delivered = new Date("2026-01-01T12:00:00Z")
    expect(
      shouldAutoConfirmDelivery(
        { deliveredAt: delivered, shippedAt: delivered, deliveryConfirmedAt: null },
        addDays(delivered, 10)
      )
    ).toBe(true)
  })
})
