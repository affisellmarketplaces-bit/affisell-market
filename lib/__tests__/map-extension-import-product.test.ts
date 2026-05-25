import { describe, expect, it } from "vitest"

import { mapScrapedProductForImportSave } from "@/lib/map-extension-import-product"

describe("mapScrapedProductForImportSave", () => {
  it("maps scrape payload to import row shape", () => {
    const row = mapScrapedProductForImportSave({
      title: "Test Lamp",
      price: 10,
      suggested_price: 25,
      images: ["https://cdn.example/a.jpg"],
      stock: 5,
      source_url: "https://shop.example/p/1",
    })
    expect(row.title).toBe("Test Lamp")
    expect(row.suggested_price).toBe(25)
    expect(row.status).toBe("draft")
    expect(Array.isArray(row.images)).toBe(true)
  })
})
