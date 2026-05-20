import { describe, expect, it } from "vitest"

import { isAliExpressImportInput, parseAliExpressProductId } from "@/lib/aliexpress-product-id"

describe("parseAliExpressProductId", () => {
  it("parses bare id", () => {
    expect(parseAliExpressProductId("1005008719608144")).toBe("1005008719608144")
  })

  it("parses item URL with trailing junk", () => {
    expect(
      parseAliExpressProductId(
        "https://www.aliexpress.com/item/1005008719608144.html e"
      )
    ).toBe("1005008719608144")
  })

  it("detects aliexpress hosts", () => {
    expect(isAliExpressImportInput("https://fr.aliexpress.com/item/1.html")).toBe(true)
  })
})
