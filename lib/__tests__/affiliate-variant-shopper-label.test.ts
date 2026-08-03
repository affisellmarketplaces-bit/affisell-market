import { describe, expect, it } from "vitest"

import {
  isPlaceholderVariantColor,
  shopperLabelFromVariantCustomData,
} from "@/lib/affiliate-variant-shopper-label"

describe("affiliate-variant-shopper-label", () => {
  it("detects placeholder Variant N keys", () => {
    expect(isPlaceholderVariantColor("Variant 1")).toBe(true)
    expect(isPlaceholderVariantColor("V2")).toBe(true)
    expect(isPlaceholderVariantColor("Noir Mat")).toBe(false)
  })

  it("prefers Couleur / aeLabel over Variant N", () => {
    expect(
      shopperLabelFromVariantCustomData("Variant 1", {
        Couleur: "Noir Mat",
        aeLabel: "Noir Mat · EU",
      })
    ).toBe("Noir Mat")
    expect(
      shopperLabelFromVariantCustomData("Variant 3 / M", {
        aeLabel: "Blanc Perle · M",
      })
    ).toBe("Blanc Perle / M")
  })
})
