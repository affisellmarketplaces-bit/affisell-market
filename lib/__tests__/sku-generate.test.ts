import { describe, expect, it } from "vitest"

import { generateVariantSku } from "@/lib/sku/generate"
import { colorSizeFromAttributes, parseVariantMapping } from "@/lib/sku/variant-mapping"

describe("generateVariantSku", () => {
  it("suffixes attribute values", () => {
    expect(generateVariantSku("AFF-00001", { Color: "Black", Size: "M" })).toBe(
      "AFF-00001-BLA-M"
    )
  })

  it("returns base when no attributes", () => {
    expect(generateVariantSku("AFF-00001", {})).toBe("AFF-00001")
  })
})

describe("variantMapping", () => {
  it("parses valid mapping", () => {
    expect(parseVariantMapping({ Color: "Black", Size: "M" })).toEqual({
      Color: "Black",
      Size: "M",
    })
  })

  it("extracts color and size", () => {
    expect(colorSizeFromAttributes({ Color: "Noir", Taille: "L" })).toEqual({
      color: "Noir",
      size: "L",
    })
  })
})
