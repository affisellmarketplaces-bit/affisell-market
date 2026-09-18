import { describe, expect, it } from "vitest"

import { withDisplayLabels, type CategoryAttributeDto } from "@/lib/category-attribute-api"
import { freeTextSelectPlaceholderKind } from "@/lib/category-attribute-select-ui"

const base = (key: string, label: string): CategoryAttributeDto => ({
  id: key,
  categoryId: "c",
  key,
  label,
  type: "TEXT",
  unit: null,
  options: [],
  required: false,
  recommended: false,
  sortOrder: 0,
  order: 0,
  validationRule: null,
  dependsOnKey: null,
  dependsOnValue: null,
  helpText: null,
})

describe("withDisplayLabels", () => {
  it("adds a localized displayLabel and keeps the canonical label", () => {
    const [a] = withDisplayLabels([base("brand", "Marque")], "de")
    expect(a?.displayLabel).toBe("Marke")
    expect(a?.label).toBe("Marque")
  })

  it("leaves unknown keys untouched", () => {
    const [a] = withDisplayLabels([base("custom_unknown_key", "Foo")], "de")
    expect(a?.displayLabel).toBeUndefined()
  })
})

describe("freeTextSelectPlaceholderKind", () => {
  it("detects RAM and storage attributes", () => {
    expect(freeTextSelectPlaceholderKind({ key: "ram_gb", label: "Mémoire RAM" } as never)).toBe("phRam")
    expect(freeTextSelectPlaceholderKind({ key: "storage_gb", label: "Stockage" } as never)).toBe("phStorage")
  })
})
