import { describe, expect, it } from "vitest"

import { parseAeCatalogFromHtmlDeep } from "@/lib/fulfillment/ae-html-deep-scrape"

describe("parseAeCatalogFromHtmlDeep", () => {
  it("extracts skuPriceList from embedded JSON fragment", () => {
    const html = `<html><script>
    {"pageModule":{"skuComponent":{"skuModule":{"skuPriceList":[
      {"skuId":"1200001111111111","skuAttr":"14:691","skuVal":{"availQuantity":3,"skuActivityAmount":{"value":"7.50"}}}
    ]}}}}}
    </script></html>`
    const parsed = parseAeCatalogFromHtmlDeep(html, "https://www.aliexpress.com/item/1.html")
    expect(parsed.aeSkus.length).toBeGreaterThan(0)
    expect(parsed.aeSkus[0]?.aeSkuId).toBe("1200001111111111")
  })

  it("extracts scattered skuId via regex when blob is missing", () => {
    const html = `fragment "skuId":"1200002222222222" and "skuId":1200003333333333`
    const parsed = parseAeCatalogFromHtmlDeep(html, "https://www.aliexpress.com/item/1.html")
    expect(parsed.aeSkus.length).toBe(2)
  })
})
