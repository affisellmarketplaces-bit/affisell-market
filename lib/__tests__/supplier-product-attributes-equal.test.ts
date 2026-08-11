import { describe, expect, it } from "vitest"

import {
  normalizeProductAttributesFromBody,
  supplierProductAttributesEqual,
} from "@/lib/supplier-product-attributes"

describe("supplierProductAttributesEqual", () => {
  it("returns true for equivalent attribute rows regardless of order", () => {
    const a = [
      { key: "material", label: "Material", value: "Leather" },
      { key: "color", label: "Color", value: "Black" },
    ]
    const b = [
      { key: "color", label: "Color", value: "Black" },
      { key: "material", label: "Material", value: "Leather" },
    ]
    expect(supplierProductAttributesEqual(a, b)).toBe(true)
  })

  it("normalizes body rows and detects changes", () => {
    const existing = normalizeProductAttributesFromBody([
      { key: "size", label: "Size", value: "42" },
    ])
    const same = normalizeProductAttributesFromBody([
      { key: "size", label: "Size", value: "42" },
    ])
    const changed = normalizeProductAttributesFromBody([
      { key: "size", label: "Size", value: "43" },
    ])
    expect(supplierProductAttributesEqual(existing, same)).toBe(true)
    expect(supplierProductAttributesEqual(existing, changed)).toBe(false)
  })
})
