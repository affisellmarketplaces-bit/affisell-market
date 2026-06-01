import { describe, expect, it } from "vitest"

import { parseAeCatalogFromHtml } from "@/lib/fulfillment/ae-catalog-from-html"
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

  it("extracts multiple skuId+skuAttr blocks with property labels", () => {
    const html = `<html>
    "productSKUPropertyList":[{"skuPropertyId":"14","skuPropertyName":"Color","skuPropertyValues":[
      {"propertyValueId":"691","propertyValueDisplayName":"Black"},
      {"propertyValueId":"692","propertyValueDisplayName":"Silver"},
      {"propertyValueId":"693","propertyValueDisplayName":"White"}
    ]}]
    {"skuId":"1200001111111111","skuAttr":"14:691","skuVal":{"skuActivityAmount":{"value":"7.50"}}}
    {"skuId":"1200002222222222","skuAttr":"14:692","skuVal":{"skuActivityAmount":{"value":"7.50"}}}
    {"skuId":"1200003333333333","skuAttr":"14:693","skuVal":{"skuActivityAmount":{"value":"7.50"}}}
    </html>`
    const parsed = parseAeCatalogFromHtmlDeep(html, "https://www.aliexpress.com/item/1.html")
    expect(parsed.aeSkus.length).toBe(3)
    expect(parsed.aeSkus.map((s) => s.matchColor)).toEqual(
      expect.arrayContaining(["black", "silver", "white"])
    )
  })

  it("decodes unicode-escaped skuId in saved pages", () => {
    const html = `<html>"skuId":\\u0031\\u0032\\u0030\\u0030\\u0030\\u0030\\u0034\\u0038\\u0034\\u0037\\u0032\\u0031\\u0037\\u0031\\u0038\\u0036\\u0036</html>`
    const parsed = parseAeCatalogFromHtml(html, "https://www.aliexpress.it/item/1005010063076436.html")
    expect(parsed.aeSkus.length).toBeGreaterThan(0)
    expect(parsed.aeSkus[0]?.aeSkuId).toBe("12000048472171866")
  })

  it("merges record scrape with plain skuId regex", () => {
    const html = `"skuId":"1200001111111111" fragment without skuAttr`
    const parsed = parseAeCatalogFromHtmlDeep(html, "https://www.aliexpress.com/item/1.html")
    expect(parsed.aeSkus.length).toBe(1)
  })
})
