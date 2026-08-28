import { describe, expect, it } from "vitest"

import {
  parseProductRequestProvenance,
  PRODUCT_REQUEST_PROVENANCE_OPTIONS,
} from "@/lib/product-request-types"

describe("parseProductRequestProvenance", () => {
  it("defaults unknown values to any", () => {
    expect(parseProductRequestProvenance(undefined)).toBe("any")
    expect(parseProductRequestProvenance("")).toBe("any")
    expect(parseProductRequestProvenance("mars")).toBe("any")
  })

  it("accepts all configured ids case-insensitively", () => {
    for (const { id } of PRODUCT_REQUEST_PROVENANCE_OPTIONS) {
      expect(parseProductRequestProvenance(id)).toBe(id)
      expect(parseProductRequestProvenance(id.toUpperCase())).toBe(id)
    }
  })

  it("trims whitespace", () => {
    expect(parseProductRequestProvenance("  china  ")).toBe("china")
  })
})
