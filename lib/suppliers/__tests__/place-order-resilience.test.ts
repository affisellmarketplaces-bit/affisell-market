import { describe, expect, it } from "vitest"

import { placeSupplierOrderJobId } from "@/lib/auto-order/bullmq/names"
import { isNonRetryablePlaceOrderError, NonRetryablePlaceOrderError } from "@/lib/suppliers/place-order-errors"

describe("place order resilience", () => {
  it("uses stable BullMQ job id per supplier fulfillment row", () => {
    expect(placeSupplierOrderJobId("sfo_abc")).toBe("place-sfo_abc")
  })

  it("classifies non-retryable errors", () => {
    expect(isNonRetryablePlaceOrderError(new NonRetryablePlaceOrderError("x"))).toBe(true)
    expect(isNonRetryablePlaceOrderError(new Error("fulfillment_provider_not_found:1"))).toBe(true)
    expect(isNonRetryablePlaceOrderError(new Error("partner_create_order_failed:503"))).toBe(false)
  })
})
