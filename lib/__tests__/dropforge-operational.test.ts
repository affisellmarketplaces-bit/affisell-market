import { describe, expect, it, beforeEach } from "vitest"

import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import {
  getScrapingBeeApiKey,
  noteScrapingBeeQuotaExhausted,
  resetScrapingBeeQuotaCircuitForTests,
} from "@/lib/import-url-scrape"

describe("validateDropForgeProductUrl", () => {
  it("accepts Amazon dp URLs", () => {
    const r = validateDropForgeProductUrl("https://www.amazon.fr/dp/B09V3KXJPB")
    expect(r.ok).toBe(true)
  })

  it("accepts AliExpress item URLs", () => {
    const r = validateDropForgeProductUrl(
      "https://www.aliexpress.com/item/1005005970123456.html"
    )
    expect(r.ok).toBe(true)
  })

  it("rejects marketplace homepages", () => {
    expect(validateDropForgeProductUrl("https://www.temu.com/").ok).toBe(false)
    expect(validateDropForgeProductUrl("https://www.amazon.fr/").ok).toBe(false)
    expect(validateDropForgeProductUrl("https://www.aliexpress.com/").ok).toBe(false)
  })

  it("rejects empty / non-https", () => {
    expect(validateDropForgeProductUrl("").code).toBe("empty")
    expect(validateDropForgeProductUrl("ftp://x.com/a").code).toBe("https")
  })
})

describe("ScrapingBee quota circuit", () => {
  beforeEach(() => {
    resetScrapingBeeQuotaCircuitForTests()
  })

  it("returns null key after quota trip even if env key exists", () => {
    const prev = process.env.SCRAPINGBEE_API_KEY
    process.env.SCRAPINGBEE_API_KEY = "test_live_key_not_placeholder"
    expect(getScrapingBeeApiKey()).toBeTruthy()
    noteScrapingBeeQuotaExhausted(60_000)
    expect(getScrapingBeeApiKey()).toBeNull()
    process.env.SCRAPINGBEE_API_KEY = prev
  })
})
