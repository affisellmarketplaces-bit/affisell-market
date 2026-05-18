import { describe, expect, it } from "vitest"

import {
  marginEur,
  parseProductVariantsFromBody,
  productVariantInputSchema,
} from "@/lib/product-variant-sku"

describe("product-variant-sku", () => {
  it("validates supplier and public prices", () => {
    const ok = productVariantInputSchema.safeParse({
      supplierPrice: 10,
      publicPrice: 25,
      stock: 5,
    })
    expect(ok.success).toBe(true)

    const bad = productVariantInputSchema.safeParse({
      supplierPrice: 30,
      publicPrice: 20,
      stock: 1,
    })
    expect(bad.success).toBe(false)
  })

  it("computes margin", () => {
    expect(marginEur(10, 24.99)).toBe(14.99)
  })

  it("requires rows when hasVariants", () => {
    const r = parseProductVariantsFromBody({ hasVariants: true, variants: [] })
    expect("error" in r && r.error).toMatch(/At least one/)
  })
})
