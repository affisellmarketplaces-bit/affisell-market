import { describe, expect, it } from "vitest"

import { marketplaceCategorySearchParams } from "@/lib/marketplace-category-nav-params.client"

describe("marketplaceCategorySearchParams", () => {
  it("sets category and clears facet noise", () => {
    const next = marketplaceCategorySearchParams(
      new URLSearchParams("category=old&cc_color=red&q=phone&dept=x"),
      "cmp_new"
    )
    expect(next.get("category")).toBe("cmp_new")
    expect(next.get("cc_color")).toBeNull()
    expect(next.get("q")).toBe("phone")
    expect(next.get("dept")).toBeNull()
    expect(next.get("subcategory")).toBeNull()
  })
})
