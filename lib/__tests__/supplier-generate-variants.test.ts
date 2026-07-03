import { describe, expect, it } from "vitest"

import {
  buildVariantComposerFormPatch,
  normalizeGenerateVariantsPayload,
  normalizeSpecsFromAi,
  type GenerateVariantsInput,
} from "@/lib/supplier-generate-variants"

const baseInput: GenerateVariantsInput = {
  prompt: "Couleurs Noir, Blanc — tailles S M L",
  title: "T-shirt coton",
  description: "",
  categoryPath: "Mode > Homme",
  bullets: [],
  basePriceEur: 19.9,
  defaultCommission: 15,
  characteristics: [
    { key: "material", label: "Matière", type: "TEXT", options: [], required: false },
    {
      key: "brand",
      label: "Marque",
      type: "SELECT",
      options: ["EcoWear", "Generic"],
      required: false,
    },
  ],
}

describe("normalizeGenerateVariantsPayload", () => {
  it("parses simple colors and sizes from AI JSON", () => {
    const result = normalizeGenerateVariantsPayload(baseInput, {
      variantMode: "simple",
      sizesText: "S, M, L",
      colors: [{ name: "Noir" }, { name: "Blanc" }],
      specs: { material: "Coton bio" },
      summary: "2 couleurs, 3 tailles",
    })

    expect(result.variantMode).toBe("simple")
    expect(result.colors.map((c) => c.name)).toEqual(["Noir", "Blanc"])
    expect(result.sizesText).toBe("S, M, L")
    expect(result.specs.material).toBe("Coton bio")
  })

  it("rejects invalid color names with commas", () => {
    const result = normalizeGenerateVariantsPayload(baseInput, {
      variantMode: "simple",
      colors: [{ name: "Noir, Blanc" }],
    })
    expect(result.colors).toHaveLength(0)
  })

  it("normalizes advanced rows with SKU mode", () => {
    const result = normalizeGenerateVariantsPayload(baseInput, {
      variantMode: "advanced",
      advancedRows: [
        { color: "Rouge", size: "M", stock: 12, supplierPriceEur: 24.5 },
        { color: "Rouge", size: "L", stock: 8 },
      ],
    })

    expect(result.variantMode).toBe("advanced")
    expect(result.advancedRows).toHaveLength(2)
    expect(result.advancedRows[0]?.stock).toBe(12)
  })
})

describe("normalizeSpecsFromAi", () => {
  it("matches SELECT options case-insensitively", () => {
    const specs = normalizeSpecsFromAi({ brand: "ecowear" }, baseInput.characteristics)
    expect(specs.brand).toBe("EcoWear")
  })
})

describe("buildVariantComposerFormPatch", () => {
  it("builds simple color rows for simple mode", () => {
    const patch = buildVariantComposerFormPatch(
      {
        variantMode: "simple",
        sizesText: "S, M",
        colors: [{ name: "Bleu", hex: null }],
        specs: {},
        advancedRows: [],
        summary: "",
      },
      { basePriceEur: 20, defaultCommission: 12 }
    )

    expect(patch.variantMode).toBe("simple")
    expect(patch.simpleColors).toHaveLength(1)
    expect(patch.simpleColors[0]?.name).toBe("Bleu")
    expect(patch.sizesText).toBe("S, M")
  })

  it("builds SKU table rows for advanced mode", () => {
    const patch = buildVariantComposerFormPatch(
      {
        variantMode: "advanced",
        sizesText: "M, L",
        colors: [{ name: "Noir", hex: null }],
        specs: { material: "Cuir" },
        advancedRows: [],
        summary: "",
      },
      { basePriceEur: 49, defaultCommission: 10, skuPrefix: "PRD" }
    )

    expect(patch.variantMode).toBe("advanced")
    expect(patch.advancedSkuRows.length).toBeGreaterThan(0)
    expect(patch.advancedSkuRows.every((r) => r.color.length > 0)).toBe(true)
    expect(patch.specValuesPatch.material).toBe("Cuir")
  })
})
