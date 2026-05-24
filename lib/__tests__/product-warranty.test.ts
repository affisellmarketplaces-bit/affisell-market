import { describe, expect, it } from "vitest"

import {
  formatWarrantyBadgeLabel,
  listingWarrantyBadgeLabel,
  maxWarrantyMonthsFromVariantJson,
  resolveProductWarrantyMonths,
} from "@/lib/product-warranty"

describe("product-warranty", () => {
  it("reads warranty months from variant JSON attrs", () => {
    const months = maxWarrantyMonthsFromVariantJson({
      variantRows: [
        { id: "a", name: "Noir / M", sku: "A", priceCents: 1000, stock: 1, commission: 10, sales: 0, attrs: { warrantyMonths: "12" } },
        { id: "b", name: "Blanc / L", sku: "B", priceCents: 1000, stock: 1, commission: 10, sales: 0, attrs: { warrantyMonths: "24" } },
      ],
    })
    expect(months).toBe(24)
  })

  it("formats years when divisible by 12", () => {
    expect(formatWarrantyBadgeLabel(24)).toBe("Garantie 2 ans")
    expect(formatWarrantyBadgeLabel(12)).toBe("Garantie 1 an")
    expect(formatWarrantyBadgeLabel(18)).toBe("Garantie 18 mois")
  })

  it("shows badge only when affiliate opted in and supplier set warranty", () => {
    expect(listingWarrantyBadgeLabel(true, 24)).toBe("Garantie 2 ans")
    expect(listingWarrantyBadgeLabel(false, 24)).toBeNull()
    expect(listingWarrantyBadgeLabel(true, null)).toBeNull()
  })

  it("merges DB variants and JSON rows", () => {
    const months = resolveProductWarrantyMonths({
      hasVariants: true,
      variants: { variantRows: [{ id: "a", name: "Noir", sku: "A", priceCents: 1000, stock: 1, commission: 10, sales: 0, attrs: { warrantyMonths: "6" } }] },
      productVariants: [{ customData: { warrantyMonths: 36 } }],
    })
    expect(months).toBe(36)
  })
})
