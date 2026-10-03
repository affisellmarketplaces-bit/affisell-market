import { describe, expect, it } from "vitest"

import { storeBuyerOrderStage, storeBuyerOrderStageIndex } from "@/lib/store-buyer-order-status"

describe("storeBuyerOrderStage", () => {
  it("starts at confirmed", () => {
    expect(storeBuyerOrderStage({ status: "paid" })).toBe("confirmed")
  })

  it("advances on timestamps or on the status string", () => {
    expect(storeBuyerOrderStage({ status: "paid", supplierPreparingAt: new Date() })).toBe("preparing")
    expect(storeBuyerOrderStage({ status: "preparing" })).toBe("preparing")
    expect(storeBuyerOrderStage({ status: "paid", shippedAt: "2026-01-01T00:00:00Z" })).toBe("shipped")
    expect(storeBuyerOrderStage({ status: "SHIPPED" })).toBe("shipped")
  })

  it("reports the furthest stage reached", () => {
    expect(
      storeBuyerOrderStage({
        status: "shipped",
        supplierPreparingAt: new Date(),
        shippedAt: new Date(),
        deliveredAt: new Date(),
      })
    ).toBe("delivered")
    expect(storeBuyerOrderStage({ status: "shipped", deliveryConfirmedAt: new Date() })).toBe("delivered")
  })

  it("lets a refund override every other signal", () => {
    expect(storeBuyerOrderStage({ status: "refunded", shippedAt: new Date(), deliveredAt: new Date() })).toBe(
      "refunded"
    )
  })

  it("maps stages to timeline positions", () => {
    expect(["confirmed", "preparing", "shipped", "delivered", "refunded"].map((s) =>
      storeBuyerOrderStageIndex(s as Parameters<typeof storeBuyerOrderStageIndex>[0])
    )).toEqual([0, 1, 2, 3, -1])
  })
})
