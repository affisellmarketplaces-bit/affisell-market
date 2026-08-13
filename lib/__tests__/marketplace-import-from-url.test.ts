import { describe, expect, it } from "vitest"

import { normalizeAeImportUrl } from "@/lib/marketplace/normalize-ae-import-url"
import {
  detectShoeProductFromText,
  enrichMarketplaceImportWithAi,
} from "@/lib/marketplace/marketplace-import-ai-enrich"
import {
  computeMarketplaceBaseSellingPriceEur,
  MARKETPLACE_IMPORT_MARKUP,
  MARKETPLACE_IMPORT_MIN_EUR,
} from "@/lib/marketplace/marketplace-import-pricing"

describe("normalizeAeImportUrl", () => {
  it("extracts id from canonical item URL", () => {
    const out = normalizeAeImportUrl(
      "https://www.aliexpress.com/item/1005012670002032.html"
    )
    expect(out?.productId).toBe("1005012670002032")
    expect(out?.canonicalUrl).toBe(
      "https://www.aliexpress.com/item/1005012670002032.html"
    )
  })

  it("extracts id from tracking URL", () => {
    const out = normalizeAeImportUrl(
      "https://s.click.aliexpress.com/e/_pTest?_p_origin_prod:1005012670002032"
    )
    expect(out?.productId).toBe("1005012670002032")
  })

  it("rejects non-AE URLs", () => {
    expect(normalizeAeImportUrl("https://amazon.fr/dp/B123")).toBeNull()
  })
})

describe("detectShoeProductFromText", () => {
  it("detects French shoe keywords", () => {
    expect(detectShoeProductFromText("Baskets urbaines légères")).toBe(true)
    expect(detectShoeProductFromText("Silicone hose 30mm")).toBe(false)
  })
})

describe("marketplace import pricing constants", () => {
  it("uses x2.5 markup with 19.99€ floor", () => {
    expect(MARKETPLACE_IMPORT_MARKUP).toBe(2.5)
    expect(MARKETPLACE_IMPORT_MIN_EUR).toBe(19.99)
    const lowCost = 3 * MARKETPLACE_IMPORT_MARKUP
    expect(computeMarketplaceBaseSellingPriceEur(3)).toBe(MARKETPLACE_IMPORT_MIN_EUR)
    expect(Math.max(MARKETPLACE_IMPORT_MIN_EUR, lowCost)).toBe(19.99)
  })
})

describe("enrichMarketplaceImportWithAi", () => {
  it("returns null without GROQ key", async () => {
    const prev = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    const out = await enrichMarketplaceImportWithAi({
      title: "Test",
      description: "Desc",
      ai_title: "",
      ai_description: "",
      price: 10,
      original_price: 10,
      currency: "EUR",
      images: [],
      videos: [],
      descriptionIllustrationImages: [],
      variants: [],
      colors: [],
      sizes: [],
      brand: "",
      category: "",
      sku: "",
      stock: 1,
      shipping: { from_country: "", delivery_time: "", shipping_cost: 0, carrier: "" },
      reviews: { total: 0, average_rating: 0, breakdown: {}, items: [], sentiment: "neutral" },
      specs: {},
      source_platform: "aliexpress",
      source_url: "https://example.com",
      basePrice: 0,
      costPrice: 10,
      suggested_price: 25,
      suggested_commission: 25,
      profit_per_sale: 15,
      roi: 150,
      tags: [],
      quality_score: 0,
      is_duplicate: false,
      seo_keywords: [],
    })
    expect(out).toBeNull()
    if (prev) process.env.GROQ_API_KEY = prev
  })
})
