import { describe, expect, it } from "vitest"

import { buildOrderTrackingIdempotencyKey } from "@/lib/order-tracking-event"

describe("buildOrderTrackingIdempotencyKey", () => {
  it("builds stable keys per order + event + source", () => {
    const key = buildOrderTrackingIdempotencyKey({
      orderId: "ord_1",
      eventType: "TRACKING_REGISTERED",
      source: "supplier_mark_shipped",
      dedupe: "8R12345678901",
    })
    expect(key).toBe("ord_1:TRACKING_REGISTERED:supplier_mark_shipped:8r12345678901")
  })

  it("falls back to default dedupe", () => {
    const key = buildOrderTrackingIdempotencyKey({
      orderId: "ord_2",
      eventType: "IN_TRANSIT",
      source: "aftership_webhook",
    })
    expect(key).toBe("ord_2:IN_TRANSIT:aftership_webhook:default")
  })

  it("dedupes delivered events once per source", () => {
    const key = buildOrderTrackingIdempotencyKey({
      orderId: "ord_3",
      eventType: "DELIVERED",
      source: "aftership_webhook",
      dedupe: "delivered",
    })
    expect(key).toBe("ord_3:DELIVERED:aftership_webhook:delivered")
  })
})
