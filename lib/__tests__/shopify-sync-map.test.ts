import { describe, expect, it } from "vitest"

import { shopifyProductToImportRow } from "@/lib/shopify-sync-map"

describe("shopifyProductToImportRow", () => {
  it("uses stable sfy-pid SKU from Shopify product id", () => {
    const row = shopifyProductToImportRow(
      {
        id: 8123456789012,
        title: "Test Hoodie",
        handle: "test-hoodie",
        variants: [{ price: "29.00", inventory_quantity: 5, sku: "VAR-SKU" }],
      },
      "demo.myshopify.com"
    )
    expect(row.sku).toBe("sfy-pid-8123456789012")
    expect(row.import_source).toBe("shopify")
    expect(row.source_url).toBe("https://demo.myshopify.com/products/test-hoodie")
  })
})
