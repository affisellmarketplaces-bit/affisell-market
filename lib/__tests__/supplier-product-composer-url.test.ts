import { describe, expect, it } from "vitest"

import {
  supplierProductComposerEditAbsoluteUrl,
  supplierProductComposerEditPath,
} from "@/lib/supplier-product-composer-url"

describe("supplierProductComposerEditPath", () => {
  it("routes drafts to the composer draft query", () => {
    expect(supplierProductComposerEditPath("prod_1", { isDraft: true })).toBe(
      "/dashboard/supplier/products/new?compose=1&draft=prod_1"
    )
  })

  it("routes live listings to the composer edit query", () => {
    expect(supplierProductComposerEditPath("prod_1")).toBe(
      "/dashboard/supplier/products/new?edit=prod_1"
    )
  })

  it("builds absolute URLs from site base", () => {
    expect(
      supplierProductComposerEditAbsoluteUrl("prod_1", "https://affisell.com/", {
        isDraft: true,
      })
    ).toBe("https://affisell.com/dashboard/supplier/products/new?compose=1&draft=prod_1")
  })
})
