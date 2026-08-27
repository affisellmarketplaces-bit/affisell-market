import { describe, expect, it } from "vitest"

import {
  buildAePageUrlCandidates,
  parseSupplierProductFromAeHtml,
} from "@/lib/fulfillment/import-aliexpress-page-product"

describe("import-aliexpress-page-product", () => {
  it("builds fr + www URL candidates for locale pages", () => {
    const urls = buildAePageUrlCandidates(
      "1005010646103822",
      "https://fr.aliexpress.com/item/1005010646103822.html?spm=test"
    )
    expect(urls).toContain("https://www.aliexpress.com/item/1005010646103822.html")
    expect(urls).toContain("https://fr.aliexpress.com/item/1005010646103822.html")
    expect(urls.length).toBeGreaterThanOrEqual(2)
  })

  it("parses Open Graph HTML into a supplier draft", () => {
    const html = `
      <meta property="og:title" content="Montre connectée Pro | AliExpress" />
      <meta property="og:description" content="Tracker fitness" />
      <meta property="og:image" content="//img.test/hero.jpg" />
      <meta property="product:price:amount" content="19.90" />
    `
    const product = parseSupplierProductFromAeHtml(
      html,
      "https://fr.aliexpress.com/item/1005010646103822.html"
    )
    expect(product?.title).toBe("Montre connectée Pro")
    expect(product?.price).toBe(19.9)
    expect(product?.images[0]).toContain("img.test")
    expect(product?.source_platform).toBe("aliexpress")
  })

  it("merges deep SKU catalog when legacy variants are empty", () => {
    const html = `<html>
      <meta property="og:title" content="SKU Test Product" />
      <script>
    {"pageModule":{"skuComponent":{"skuModule":{"skuPriceList":[
      {"skuId":"1200001111111111","skuAttr":"14:691","skuVal":{"availQuantity":3,"skuActivityAmount":{"value":"7.50"}}}
    ]}}}}}
    </script></html>`
    const fromHtml = parseSupplierProductFromAeHtml(html, "https://www.aliexpress.com/item/1.html")
    expect(fromHtml?.title).toBe("SKU Test Product")
    expect(fromHtml?.variants.length).toBeGreaterThan(0)
    expect(fromHtml?.variants[0]?.sku).toBe("1200001111111111")
  })
})
