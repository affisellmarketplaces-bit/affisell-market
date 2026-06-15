import { describe, expect, it } from "vitest"

import { resolveGraduatedBuyerShopUrl } from "@/lib/expansion/graduated-buyer-shop-url"

describe("resolveGraduatedBuyerShopUrl", () => {
  it("points buyers to standalone browse with shipsTo filter", () => {
    expect(resolveGraduatedBuyerShopUrl("JP", "https://affisell.com")).toBe(
      "https://affisell.com/shops/browse?shipsTo=jp"
    )
  })
})
