import { describe, expect, it } from "vitest"

import {
  mapSupplierOrderStatusToFulfillment,
  parsePartnerOrderStatusPayload,
} from "@/lib/suppliers/order-status"

describe("supplier order status", () => {
  it("parses partner status strings", () => {
    expect(parsePartnerOrderStatusPayload({ status: "shipped" })).toBe("SHIPPED")
    expect(parsePartnerOrderStatusPayload({ state: "cancelled" })).toBe("CANCELLED")
  })

  it("maps to prisma fulfillment status", () => {
    expect(mapSupplierOrderStatusToFulfillment("DELIVERED")).toBe("DELIVERED")
    expect(mapSupplierOrderStatusToFulfillment("FAILED")).toBe("FAILED")
  })
})
