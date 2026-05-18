import { describe, expect, it } from "vitest"

import {
  buildVariantOptionLabel,
  clampPurchaseQuantity,
  resolveListingAvailableStock,
} from "@/lib/marketplace-purchase-quantity"

describe("marketplace-purchase-quantity", () => {
  it("builds color / size label", () => {
    expect(buildVariantOptionLabel("Noir", "M")).toBe("Noir / M")
    expect(buildVariantOptionLabel("Noir", null)).toBe("Noir")
  })

  it("uses variant row stock when matched", () => {
    expect(
      resolveListingAvailableStock({
        productStock: 100,
        variants: {
          variantRows: [
            { id: "1", name: "Noir / M", sku: "", priceCents: 0, stock: 7, commission: 15, sales: 0 },
          ],
        },
        selectedColor: "Noir",
        selectedSize: "M",
      })
    ).toBe(7)
  })

  it("clamps quantity to stock", () => {
    expect(clampPurchaseQuantity(50, 12)).toBe(12)
    expect(clampPurchaseQuantity(0, 5)).toBe(1)
  })
})
