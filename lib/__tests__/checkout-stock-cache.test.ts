import { describe, expect, it } from "vitest"

import { tryCheckoutStockCache } from "@/lib/ghost/checkout-stock-cache"
import {
  GHOST_CHECKOUT_CACHE_MS,
  GHOST_CHECKOUT_OOS_CACHE_MS,
} from "@/lib/ghost/types"

describe("tryCheckoutStockCache", () => {
  it("returns in_stock when last check is fresh", () => {
    const checkedAt = new Date(Date.now() - GHOST_CHECKOUT_CACHE_MS + 60_000)
    const cached = tryCheckoutStockCache({
      basePriceCents: 5000,
      lastStockCheck: checkedAt,
      lastStockStatus: "in_stock",
      lastPriceSupplier: 42.5,
    })
    expect(cached?.status).toBe("in_stock")
    expect(cached?.source).toBe("cache:checkout_in_stock")
  })

  it("returns out_of_stock within short OOS cache window", () => {
    const checkedAt = new Date(Date.now() - GHOST_CHECKOUT_OOS_CACHE_MS + 5_000)
    const cached = tryCheckoutStockCache({
      basePriceCents: 5000,
      lastStockCheck: checkedAt,
      lastStockStatus: "out_of_stock",
      lastPriceSupplier: null,
    })
    expect(cached?.status).toBe("out_of_stock")
  })

  it("returns null when cache is stale", () => {
    const checkedAt = new Date(Date.now() - GHOST_CHECKOUT_CACHE_MS - 1_000)
    const cached = tryCheckoutStockCache({
      basePriceCents: 5000,
      lastStockCheck: checkedAt,
      lastStockStatus: "in_stock",
      lastPriceSupplier: null,
    })
    expect(cached).toBeNull()
  })
})
