import { describe, expect, it } from "vitest"

import { importAeCatalogForAdmin } from "@/lib/fulfillment/import-ae-catalog-admin"

const AER = {
  pageModule: {
    productInfoComponent: {
      productInfo: { subject: "Test", storeId: "999" },
    },
    skuComponent: {
      skuModule: {
        productSKUPropertyList: [],
        skuPriceList: [
          {
            skuId: "1200001111111111",
            skuVal: { availQuantity: 5, skuActivityAmount: { value: "9.99" } },
          },
        ],
      },
    },
  },
}

describe("importAeCatalogForAdmin", () => {
  it("imports from embedded HTML string", async () => {
    const html = `<html><script>window.__AER_DATA__ = ${JSON.stringify(AER)};</script></html>`
    const out = await importAeCatalogForAdmin(
      "https://www.aliexpress.com/item/1005007033418319.html",
      [{ id: "pv1", color: "Black", size: null }],
      { html }
    )
    expect(out.source).toBe("html")
    expect(out.resolved.aeSkus).toHaveLength(1)
    expect(out.resolved.aeSkus[0]?.aeSkuId).toBe("1200001111111111")
  })
})
