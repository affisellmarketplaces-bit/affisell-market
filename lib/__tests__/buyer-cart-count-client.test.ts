import { describe, expect, it } from "vitest"

import { sumBuyerCartLines } from "@/lib/buyer-cart-count-client"

describe("sumBuyerCartLines", () => {
  it("sums qty fields across lines", () => {
    expect(
      sumBuyerCartLines([
        { qty: 2 },
        { quantity: 3 },
        { qty: 1 },
      ])
    ).toBe(6)
  })

  it("defaults missing qty to 1", () => {
    expect(sumBuyerCartLines([{ id: "a" }, { id: "b" }])).toBe(2)
  })
})
