import { describe, expect, it } from "vitest"

import {
  buildWizardV2NewProductUrl,
  quoteShellUrl,
  WIZARD_V2_NEW_PRODUCT_PATH,
} from "@/lib/product-wizard-v2/dev-url"

describe("wizard-v2 dev-url", () => {
  it("builds new product URL from PORT env", () => {
    const url = buildWizardV2NewProductUrl({ wizard: "v2", compose: "1" }, { PORT: "4000" })
    expect(url).toBe("http://localhost:4000/dashboard/supplier/products/new?wizard=v2&compose=1")
  })

  it("exports stable path constant", () => {
    expect(WIZARD_V2_NEW_PRODUCT_PATH).toBe("/dashboard/supplier/products/new")
  })

  it("quotes URL for zsh-safe shell paste", () => {
    const url = buildWizardV2NewProductUrl()
    expect(quoteShellUrl(url)).toBe(
      '"http://localhost:3001/dashboard/supplier/products/new?wizard=v2&compose=1"'
    )
  })
})
