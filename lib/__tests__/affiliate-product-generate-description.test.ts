import { describe, expect, it } from "vitest"

import {
  extractMaterialAndDimensions,
  formatAffiliateListingDescriptionFromAi,
  parseProductDescriptionAiPayload,
  resolveSupplierPriceEur,
} from "@/lib/affiliate-product-generate-description"

describe("affiliate-product-generate-description", () => {
  it("parses AI JSON payload", () => {
    const result = parseProductDescriptionAiPayload({
      seoTitle: "Smartphone 17 Pro Max 5G — écran XL",
      accroche: "Un téléphone pensé pour toi, rapide et autonome.",
      benefices: ["Écran immersif", "Double SIM", "Batterie longue durée"],
      storytelling: "Tu veux un smartphone sans compromis ? Le 17 Pro Max combine puissance et autonomie.",
      specs: [{ label: "Dimensions", value: "L165 x P78 x H8 mm" }],
      faq: [{ q: "Double SIM ?", a: "Oui, deux cartes actives." }],
    })
    expect(result?.seoTitle.length).toBeLessThanOrEqual(60)
    expect(result?.benefices).toHaveLength(3)
  })

  it("formats listing description from AI blocks", () => {
    const formatted = formatAffiliateListingDescriptionFromAi({
      seoTitle: "Test",
      accroche: "Accroche client.",
      benefices: ["B1", "B2"],
      storytelling: "Story.",
      specs: [{ label: "Matériau", value: "Alu" }],
      faq: [{ q: "Livraison ?", a: "Sous 5 jours." }],
    })
    expect(formatted).toContain("CE QUE TU GAGNES")
    expect(formatted).toContain("FAQ")
    expect(formatted).toContain("Accroche client.")
  })

  it("extracts material and dimensions from attributes", () => {
    const r = extractMaterialAndDimensions([
      { key: "material", label: "Material", value: "ABS" },
      { key: "dimensions", label: "Dimensions", value: "10x20 cm" },
      { key: "brand", label: "Brand", value: "Acme" },
    ])
    expect(r.material).toBe("ABS")
    expect(r.dimensions).toBe("10x20 cm")
    expect(r.extra).toHaveLength(1)
  })

  it("resolves supplier price from variants", () => {
    expect(
      resolveSupplierPriceEur({
        basePriceCents: 9999,
        productVariants: [{ supplierPrice: { toString: () => "89.50" } }],
      })
    ).toBe(89.5)
  })
})
