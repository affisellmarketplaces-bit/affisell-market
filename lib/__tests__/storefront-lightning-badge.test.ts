import { describe, expect, it } from "vitest"

import type { ShopProductCard } from "@/lib/shop-storefront-shared"

function showLightningBadge(product: Pick<ShopProductCard, "supplier">): boolean {
  const supplier = product.supplier
  if (!supplier) return false
  return supplier.lightningEnabled && supplier.trustScore >= 80
}

describe("storefront lightning badge", () => {
  it("shows when lightning enabled and trust >= 80", () => {
    expect(
      showLightningBadge({
        supplier: { lightningEnabled: true, trustScore: 80 },
      })
    ).toBe(true)
  })

  it("hides when trust below 80 or lightning off", () => {
    expect(
      showLightningBadge({
        supplier: { lightningEnabled: true, trustScore: 79 },
      })
    ).toBe(false)
    expect(
      showLightningBadge({
        supplier: { lightningEnabled: false, trustScore: 100 },
      })
    ).toBe(false)
    expect(showLightningBadge({ supplier: null })).toBe(false)
  })
})
