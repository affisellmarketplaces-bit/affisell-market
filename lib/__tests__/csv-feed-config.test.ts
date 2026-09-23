import { describe, expect, it } from "vitest"

import {
  csvFeedFieldMapIsComplete,
  mapCsvRowsToCanonical,
  mapCsvRowToCanonical,
  parseCsvFeedConfig,
} from "@/lib/integrations/csv-feed-config"

const FIELD_MAP = {
  title: "Product Name",
  price: "Price EUR",
  sku: "Ref",
  stock: "Qty",
  images: "Image",
  category: "Cat",
  description: "Desc",
}

describe("csvFeedFieldMapIsComplete", () => {
  it("requires at least title and price", () => {
    expect(csvFeedFieldMapIsComplete({ title: "Name", price: "Price" })).toBe(true)
    expect(csvFeedFieldMapIsComplete({ title: "Name" })).toBe(false)
    expect(csvFeedFieldMapIsComplete({})).toBe(false)
  })
})

describe("parseCsvFeedConfig", () => {
  it("accepts a feedUrl + complete fieldMap", () => {
    const parsed = parseCsvFeedConfig({ feedUrl: "https://example.com/feed.csv", fieldMap: FIELD_MAP })
    expect(parsed?.feedUrl).toBe("https://example.com/feed.csv")
    expect(parsed?.fieldMap.title).toBe("Product Name")
  })

  it("rejects a missing feedUrl", () => {
    expect(parseCsvFeedConfig({ fieldMap: FIELD_MAP })).toBeNull()
  })

  it("rejects an incomplete fieldMap (no price column)", () => {
    expect(parseCsvFeedConfig({ feedUrl: "https://example.com/feed.csv", fieldMap: { title: "Name" } })).toBeNull()
  })

  it("rejects malformed input", () => {
    expect(parseCsvFeedConfig(null)).toBeNull()
    expect(parseCsvFeedConfig("csv")).toBeNull()
  })
})

describe("mapCsvRowToCanonical", () => {
  it("maps a well-formed row to a canonical product", () => {
    const product = mapCsvRowToCanonical(
      { "Product Name": "Wireless Mouse", "Price EUR": "19.90", Ref: "SKU-1", Qty: "12", Image: "https://x.com/a.jpg", Cat: "Tech", Desc: "Great mouse" },
      FIELD_MAP,
      0
    )
    expect(product).not.toBeNull()
    expect(product?.externalId).toBe("SKU-1")
    expect(product?.title).toBe("Wireless Mouse")
    expect(product?.priceCents).toBe(1990)
    expect(product?.inventoryQuantity).toBe(12)
    expect(product?.images).toEqual([{ url: "https://x.com/a.jpg" }])
  })

  it("accepts a comma decimal separator", () => {
    const product = mapCsvRowToCanonical({ "Product Name": "Item", "Price EUR": "19,90" }, FIELD_MAP, 0)
    expect(product?.priceCents).toBe(1990)
  })

  it("returns null when title is missing", () => {
    expect(mapCsvRowToCanonical({ "Price EUR": "9.90" }, FIELD_MAP, 0)).toBeNull()
  })

  it("returns null when price is missing or non-positive", () => {
    expect(mapCsvRowToCanonical({ "Product Name": "Item" }, FIELD_MAP, 0)).toBeNull()
    expect(mapCsvRowToCanonical({ "Product Name": "Item", "Price EUR": "0" }, FIELD_MAP, 0)).toBeNull()
    expect(mapCsvRowToCanonical({ "Product Name": "Item", "Price EUR": "-5" }, FIELD_MAP, 0)).toBeNull()
  })

  it("falls back to a slug of the title when no SKU column is mapped", () => {
    const noSkuMap = { title: "Product Name", price: "Price EUR" }
    const product = mapCsvRowToCanonical({ "Product Name": "Blue Widget", "Price EUR": "5" }, noSkuMap, 0)
    expect(product?.externalId).toBe("blue-widget")
  })
})

describe("mapCsvRowsToCanonical", () => {
  it("skips unsellable rows and de-duplicates identities", () => {
    const rows = [
      { "Product Name": "A", "Price EUR": "10", Ref: "SKU-A" },
      { "Product Name": "", "Price EUR": "10", Ref: "SKU-B" }, // no title
      { "Product Name": "C", "Price EUR": "0", Ref: "SKU-C" }, // bad price
      { "Product Name": "A dup", "Price EUR": "12", Ref: "SKU-A" }, // duplicate SKU
    ]
    const products = mapCsvRowsToCanonical(rows, FIELD_MAP)
    expect(products).toHaveLength(1)
    expect(products[0]?.title).toBe("A")
  })
})
