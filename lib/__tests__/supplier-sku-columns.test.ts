import { describe, expect, it } from "vitest"

import {
  isSkuColumnVisible,
  parseSkuHiddenColumns,
  toggleSkuHiddenColumn,
} from "@/lib/supplier-sku-columns"

describe("supplier-sku-columns", () => {
  it("parses hidden column keys", () => {
    expect(parseSkuHiddenColumns(["photo", "supplierPrice", "sku", "invalid"])).toEqual([
      "photo",
      "supplierPrice",
      "sku",
    ])
  })

  it("toggles visibility", () => {
    expect(toggleSkuHiddenColumn([], "stock")).toEqual(["stock"])
    expect(toggleSkuHiddenColumn(["stock"], "stock")).toEqual([])
    expect(isSkuColumnVisible(["photo"], "photo")).toBe(false)
    expect(isSkuColumnVisible(["photo"], "size")).toBe(true)
  })
})
