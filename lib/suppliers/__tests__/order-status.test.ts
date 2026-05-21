import { describe, expect, it } from "vitest"

import {
  mapOrderStatusToFulfillment,
  parsePartnerOrderStatusPayload,
} from "@/lib/suppliers/order-status"

describe("supplier order status", () => {
  it("parses partner status strings", () => {
    expect(parsePartnerOrderStatusPayload({ status: "shipped" })).toBe("SHIPPED")
    expect(parsePartnerOrderStatusPayload({ state: "cancelled" })).toBe("CANCELLED")
    expect(parsePartnerOrderStatusPayload({ status: "confirmed" })).toBe("CONFIRMED")
  })

  it("maps to prisma fulfillment status", () => {
    expect(mapOrderStatusToFulfillment("DELIVERED")).toBe("DELIVERED")
    expect(mapOrderStatusToFulfillment("CONFIRMED")).toBe("CONFIRMED")
    expect(mapOrderStatusToFulfillment("FAILED")).toBe("FAILED")
  })
})
