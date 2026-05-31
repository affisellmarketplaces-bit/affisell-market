import { describe, expect, it } from "vitest"

import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import {
  buildCategorySelectSuggestions,
  categorySelectAllowsFreeText,
  GENERIC_BRAND_LABEL,
  isBrandCategoryAttribute,
} from "@/lib/category-attribute-select-ui"

const brandAttr: CategoryAttrRow = {
  id: "1",
  key: "brand",
  label: "Marque",
  type: "SELECT",
  unit: null,
  options: ["Apple", "Dell", "MSI"],
  required: true,
  order: 1,
}

const ramAttr: CategoryAttrRow = {
  id: "2",
  key: "ram_gb",
  label: "Mémoire RAM (Go)",
  type: "SELECT",
  unit: null,
  options: ["8", "16", "32"],
  required: false,
  order: 2,
}

describe("category-attribute-select-ui", () => {
  it("detects brand attributes", () => {
    expect(isBrandCategoryAttribute(brandAttr)).toBe(true)
    expect(isBrandCategoryAttribute(ramAttr)).toBe(false)
  })

  it("puts Générique first in brand suggestions", () => {
    const s = buildCategorySelectSuggestions(brandAttr)
    expect(s[0]).toBe(GENERIC_BRAND_LABEL)
    expect(s).toContain("MSI")
  })

  it("allows free text for brand and RAM-like fields", () => {
    expect(categorySelectAllowsFreeText(brandAttr)).toBe(true)
    expect(categorySelectAllowsFreeText(ramAttr)).toBe(true)
  })
})
