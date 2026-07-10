import { describe, expect, it } from "vitest"

import {
  mapSupplierCsvRows,
  parseCsvText,
  rowsToObjects,
  suggestSupplierCsvMapping,
  SUPPLIER_CSV_TEMPLATE_SAMPLE,
} from "@/lib/supplier-csv-import"

describe("supplier-csv-import", () => {
  it("parses template CSV", () => {
    const { headers, rows } = parseCsvText(SUPPLIER_CSV_TEMPLATE_SAMPLE)
    expect(headers).toEqual([
      "title",
      "description",
      "price_eur",
      "stock",
      "image_url",
      "category",
      "shipping_days",
    ])
    expect(rows.length).toBe(2)
  })

  it("suggests column mapping from headers", () => {
    const mapping = suggestSupplierCsvMapping([
      "title",
      "description",
      "price_eur",
      "stock",
      "image_url",
      "category",
      "shipping_days",
    ])
    expect(mapping.title).toBe("title")
    expect(mapping.price_eur).toBe("price_eur")
  })

  it("maps rows with validation", () => {
    const { headers, rows } = parseCsvText(SUPPLIER_CSV_TEMPLATE_SAMPLE)
    const objects = rowsToObjects(headers, rows)
    const mapping = suggestSupplierCsvMapping(headers)
    const mapped = mapSupplierCsvRows(objects, mapping)
    expect(mapped[0]?.title).toBe("T-shirt bio")
    expect(mapped[0]?.errors).toEqual([])
    expect(mapped[0]?.priceEur).toBeCloseTo(24.9)
  })
})
