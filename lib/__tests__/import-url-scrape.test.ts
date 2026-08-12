import { describe, expect, it } from "vitest"

import {
  aliExpressCountryCode,
  detectImportPlatform,
  extractWindowJson,
  getScrapingBeeApiKey,
  normalizeImportUrl,
  parseAliExpressHtml,
} from "@/lib/import-url-scrape"
import { extract1688Id } from "@/lib/onebound"

describe("import-url-scrape", () => {
  it("detects 1688 offer URLs as the 1688 platform", () => {
    expect(detectImportPlatform("https://detail.1688.com/offer/610947572360.html")).toBe("1688")
    expect(extract1688Id("https://detail.1688.com/offer/610947572360.html?spm=x")).toBe(
      "610947572360"
    )
    expect(extract1688Id("https://example.com/produit")).toBeNull()
  })

  it("normalizes AliExpress item URLs to canonical www host", () => {
    const url =
      "https://fr.aliexpress.com/item/1005008719608144.html?spm=a2g0o.productlist.main.1"
    expect(normalizeImportUrl(url, "aliexpress")).toBe(
      "https://www.aliexpress.com/item/1005008719608144.html"
    )
  })

  it("normalizes AliExpress tracking URLs via embedded id", () => {
    expect(
      normalizeImportUrl(
        "https://s.click.aliexpress.com/e/_p?_p_origin_prod:1005012670002032",
        "aliexpress"
      )
    ).toBe("https://www.aliexpress.com/item/1005012670002032.html")
  })

  it("detects aliexpress.us as aliexpress platform", () => {
    expect(detectImportPlatform("https://www.aliexpress.us/item/1005008719608144.html")).toBe(
      "aliexpress"
    )
  })

  it("detects country code from locale host", () => {
    expect(aliExpressCountryCode("https://fr.aliexpress.com/item/1.html")).toBe("fr")
    expect(aliExpressCountryCode("https://www.aliexpress.com/item/1.html")).toBe("us")
  })

  it("rejects placeholder ScrapingBee keys", () => {
    const prev = process.env.SCRAPINGBEE_API_KEY
    process.env.SCRAPINGBEE_API_KEY = "free_key_here"
    expect(getScrapingBeeApiKey()).toBeNull()
    process.env.SCRAPINGBEE_API_KEY = prev
  })

  it("extracts window JSON variables", () => {
    const html = `<script>window.__AER_DATA__ = {"pageModule":{"x":1}};</script>`
    expect(extractWindowJson(html, ["__AER_DATA__"])).toEqual({ pageModule: { x: 1 } })
  })

  it("parses Open Graph fallback", () => {
    const html = `
      <meta property="og:title" content="Smart Band Pro | AliExpress" />
      <meta property="og:description" content="Fitness tracker" />
      <meta property="og:image" content="//img.test/1.jpg" />
      <meta property="product:price:amount" content="24.99" />
    `
    const parsed = parseAliExpressHtml(html, "https://www.aliexpress.com/item/99.html")
    expect(parsed?.title).toBe("Smart Band Pro")
    expect(parsed?.price).toBe(24.99)
    expect(parsed?.images[0]).toContain("img.test")
  })
})
