import { describe, expect, it } from "vitest"

import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"

describe("detectMarketplaceFromUrl", () => {
  it("detects major marketplaces", () => {
    expect(detectMarketplaceFromUrl("https://www.aliexpress.com/item/1005008719608144.html").id).toBe(
      "aliexpress"
    )
    expect(detectMarketplaceFromUrl("https://www.amazon.fr/dp/B0TEST").id).toBe("amazon")
    expect(detectMarketplaceFromUrl("https://www.ebay.fr/itm/123").id).toBe("ebay")
    expect(detectMarketplaceFromUrl("https://www.etsy.com/listing/1").id).toBe("etsy")
    expect(detectMarketplaceFromUrl("https://www.cdiscount.com/produit.html").id).toBe("cdiscount")
    expect(detectMarketplaceFromUrl("https://www.temu.com/goods.html").id).toBe("temu")
  })
})
