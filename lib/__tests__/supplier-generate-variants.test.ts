import { describe, expect, it } from "vitest"

import { tryParseConfigurationMatrixFromPrompt } from "@/lib/supplier-configuration-variants"
import {
  buildVariantComposerFormPatch,
  generateSupplierVariantsFromPrompt,
  normalizeGenerateVariantsPayload,
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

describe("tryParseConfigurationMatrixFromPrompt", () => {
  it("parses RAM/SSD configuration lines into custom columns and rows", () => {
    const prompt = `Modèle de Processeur:
12 Go de RAM, 256 Go de SSD
12 Go de RAM, 1 To de SSD
12 Go de RAM, 512 Go de SSD
12 Go de RAM, 256 Go de SSD
12 Go de RAM, 2 To de SSD`

    const matrix = tryParseConfigurationMatrixFromPrompt(prompt)
    expect(matrix).not.toBeNull()
    expect(matrix!.customColumns.map((c) => c.key)).toEqual(expect.arrayContaining(["ram", "ssd"]))
    expect(matrix!.rows).toHaveLength(4)
    expect(matrix!.rows[0]?.attributes.ram).toMatch(/12 Go de RAM/i)
    expect(matrix!.rows[0]?.attributes.ssd).toMatch(/256 Go de SSD/i)
  })
})

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

  it("parses advanced configuration rows with customFields", () => {
    const result = normalizeGenerateVariantsPayload(baseInput, {
      variantMode: "advanced",
      hideSizeColumn: true,
      customColumns: [
        { key: "ram", label: "RAM", type: "text" },
        { key: "ssd", label: "Stockage SSD", type: "text" },
      ],
      advancedRows: [
        {
          color: "12 Go de RAM · 256 Go de SSD",
          customFields: { ram: "12 Go de RAM", ssd: "256 Go de SSD" },
        },
      ],
    })

    expect(result.variantMode).toBe("advanced")
    expect(result.customColumns).toHaveLength(2)
    expect(result.advancedRows[0]?.customFields.ram).toBe("12 Go de RAM")
    expect(result.hideSizeColumn).toBe(true)
  })
})

describe("buildVariantComposerFormPatch", () => {
  it("creates SKU rows with editable custom columns for configurations", () => {
    const patch = buildVariantComposerFormPatch(
      {
        variantMode: "advanced",
        sizesText: "",
        colors: [],
        specs: {},
        customColumns: [
          { key: "ram", label: "RAM", type: "text" },
          { key: "ssd", label: "Stockage SSD", type: "text" },
        ],
        hideSizeColumn: true,
        advancedRows: [
          {
            color: "12 Go de RAM / 256 Go de SSD",
            size: null,
            sku: null,
            supplierPriceEur: 799,
            stock: 5,
            customFields: { ram: "12 Go de RAM", ssd: "256 Go de SSD" },
          },
        ],
        summary: "",
      },
      { basePriceEur: 799, defaultCommission: 10, skuPrefix: "PRD" }
    )

    expect(patch.variantMode).toBe("advanced")
    expect(patch.skuCustomColumns).toHaveLength(2)
    expect(patch.skuHiddenColumnsPatch).toContain("size")
    expect(patch.advancedSkuRows[0]?.customFields?.ram).toBe("12 Go de RAM")
    expect(patch.advancedSkuRows[0]?.customData?.ssd).toBe("256 Go de SSD")
  })
})

describe("generateSupplierVariantsFromPrompt heuristic", () => {
  it("uses configuration parser without calling AI", async () => {
    const result = await generateSupplierVariantsFromPrompt({
      ...baseInput,
      prompt: `12 Go de RAM, 256 Go de SSD
12 Go de RAM, 1 To de SSD`,
    })

    expect(result.variantMode).toBe("advanced")
    expect(result.advancedRows.length).toBeGreaterThan(0)
    expect(result.customColumns.some((c) => c.key === "ram")).toBe(true)
  })
})
