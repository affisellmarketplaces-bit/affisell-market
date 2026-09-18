import { describe, expect, it } from "vitest"

import { validateAndParseBulkRow } from "@/lib/supplier-bulk-excel"

describe("validateAndParseBulkRow — localized messages", () => {
  it("defaults to English error messages", () => {
    const result = validateAndParseBulkRow(2, {}, [])
    expect(result.errors).toContain("Missing name")
  })

  it("returns French error messages when locale is fr", () => {
    const result = validateAndParseBulkRow(2, {}, [], "fr")
    expect(result.errors).toContain("Nom manquant")
  })

  it("localizes price validation errors", () => {
    const result = validateAndParseBulkRow(
      2,
      { name: "Produit", price_eur: "", images: "https://cdn.example.com/a.jpg" },
      [],
      "de"
    )
    expect(result.errors.some((e) => e.includes("erforderlich"))).toBe(true)
  })

  it("localizes required-characteristic errors with the label interpolated", () => {
    const result = validateAndParseBulkRow(
      2,
      { name: "Produit", price_eur: "9.99", images: "https://cdn.example.com/a.jpg" },
      [{ key: "color", label: "Couleur", type: "TEXT", unit: null, options: [], required: true }],
      "fr"
    )
    expect(result.errors).toContain("Caractéristique requise : Couleur (color)")
  })

  it("parses a fully valid row with no errors regardless of locale", () => {
    const result = validateAndParseBulkRow(
      2,
      {
        name: "Produit",
        price_eur: "19.99",
        images: "https://cdn.example.com/a.jpg",
      },
      [],
      "es"
    )
    expect(result.errors).toEqual([])
    expect(result.data?.name).toBe("Produit")
  })
})
