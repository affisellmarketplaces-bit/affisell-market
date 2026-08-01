import { describe, expect, it, beforeEach } from "vitest"

import {
  isDropForgeImportComplete,
  mergeScrapedProducts,
} from "@/lib/dropforge-complete-import"
import { resolveDropForgeFulfillmentMeta } from "@/lib/dropforge-fulfillment"
import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import {
  getScrapingBeeApiKey,
  noteScrapingBeeQuotaExhausted,
  resetScrapingBeeQuotaCircuitForTests,
} from "@/lib/import-url-scrape"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"

describe("validateDropForgeProductUrl", () => {
  it("accepts Amazon dp URLs", () => {
    const r = validateDropForgeProductUrl("https://www.amazon.fr/dp/B09V3KXJPB")
    expect(r.ok).toBe(true)
  })

  it("accepts AliExpress item URLs", () => {
    const r = validateDropForgeProductUrl(
      "https://www.aliexpress.com/item/1005008719608144.html"
    )
    expect(r.ok).toBe(true)
  })

  it("rejects marketplace homepages", () => {
    expect(validateDropForgeProductUrl("https://www.temu.com/").ok).toBe(false)
    expect(validateDropForgeProductUrl("https://www.amazon.fr/").ok).toBe(false)
    expect(validateDropForgeProductUrl("https://www.aliexpress.com/").ok).toBe(false)
  })

  it("rejects empty / non-https", () => {
    const empty = validateDropForgeProductUrl("")
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.code).toBe("empty")
    const bad = validateDropForgeProductUrl("ftp://x.com/a")
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.code).toBe("https")
  })

  it("rejects private / metadata hosts (SSRF)", () => {
    const blocked = validateDropForgeProductUrl("https://169.254.169.254/latest/meta-data/")
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe("blocked")
    expect(validateDropForgeProductUrl("http://127.0.0.1/admin").ok).toBe(false)
    expect(validateDropForgeProductUrl("https://localhost/product/1").ok).toBe(false)
  })
})

describe("DropForge fulfillment readiness (P0)", () => {
  it("marks AliExpress URLs as fulfillment-ready", () => {
    const meta = resolveDropForgeFulfillmentMeta({
      sourceUrl: "https://www.aliexpress.com/item/1005008719608144.html",
    })
    expect(meta.fulfillmentReady).toBe(true)
    expect(meta.fulfillmentReason).toBe("aliexpress")
    expect(meta.aliexpressProductId).toBe("1005008719608144")
  })

  it("marks catalog products with SupplierLink as ready", () => {
    const meta = resolveDropForgeFulfillmentMeta({
      sourceUrl: "https://www.amazon.fr/dp/B09V3KXJPB",
      catalogProductId: "prod_1",
      catalogHasSupplierLink: true,
    })
    expect(meta.fulfillmentReady).toBe(true)
    expect(meta.fulfillmentReason).toBe("catalog_link")
  })

  it("blocks Amazon/Temu without catalog link for affiliates", () => {
    const amazon = resolveDropForgeFulfillmentMeta({
      sourceUrl: "https://www.amazon.fr/dp/B09V3KXJPB",
    })
    expect(amazon.fulfillmentReady).toBe(false)
    expect(amazon.fulfillmentReason).toBe("pending_ops")

    const temu = resolveDropForgeFulfillmentMeta({
      sourceUrl: "https://www.temu.com/fr-fr/g-601099512345678.html",
      catalogProductId: "prod_x",
      catalogHasSupplierLink: false,
    })
    expect(temu.fulfillmentReady).toBe(false)
  })

  it("allows Amazon/Temu for supplier B2B catalog with manual fulfillment", () => {
    const amazon = resolveDropForgeFulfillmentMeta({
      sourceUrl: "https://www.amazon.fr/dp/B09V3KXJPB",
      supplierCatalog: true,
    })
    expect(amazon.fulfillmentReady).toBe(true)
    expect(amazon.fulfillmentReason).toBe("manual_supplier")

    const temu = resolveDropForgeFulfillmentMeta({
      sourceUrl: "https://www.temu.com/fr-fr/g-601099512345678.html",
      supplierCatalog: true,
    })
    expect(temu.fulfillmentReady).toBe(true)
    expect(temu.fulfillmentReason).toBe("manual_supplier")
  })
})

describe("DropForge complete import gate", () => {
  it("rejects empty shells", () => {
    expect(
      isDropForgeImportComplete({
        title: "x",
        description: "y",
        images: [],
        costPrice: 1,
      })
    ).toBe(false)
  })

  it("accepts full fiches", () => {
    expect(
      isDropForgeImportComplete({
        title: "Real product title",
        description: "Full description text",
        images: ["https://cdn.example.com/a.jpg"],
        costPrice: 12.5,
      })
    ).toBe(true)
  })

  it("merges scraped products without dropping fields", () => {
    const a = {
      title: "Primary",
      description: "",
      ai_title: "Primary",
      ai_description: "",
      price: 10,
      original_price: 12,
      currency: "EUR",
      images: ["https://a.test/1.jpg"],
      videos: [],
      variants: [
        {
          name: "S",
          type: "Size",
          image: "",
          price: 10,
          stock: 2,
          sku: "s",
          attributes: {},
        },
      ],
      colors: [],
      sizes: [{ name: "S", value: "S" }],
      brand: "Acme",
      category: "Cat",
      sku: "sku1",
      stock: 5,
      shipping: {
        from_country: "China",
        delivery_time: "10-20",
        shipping_cost: 0,
        carrier: "",
      },
      reviews: {
        total: 0,
        average_rating: 0,
        breakdown: {},
        items: [],
        sentiment: "neutral" as const,
      },
      specs: { Material: "Cotton" },
      source_platform: "aliexpress",
      source_url: "https://x.test",
      basePrice: 28,
      costPrice: 10,
      suggested_price: 28,
      suggested_commission: 15,
      profit_per_sale: 18,
      roi: 180,
      tags: ["a"],
      quality_score: 70,
      is_duplicate: false,
      seo_keywords: ["kw"],
    } satisfies SupplierScrapedProduct
    const b = {
      ...a,
      title: "",
      description: "From OG",
      images: ["https://b.test/2.jpg"],
      videos: ["https://cdn.test/v.mp4"],
      price: 0,
      specs: { Color: "Red" },
      tags: ["b"],
    } satisfies SupplierScrapedProduct
    const m = mergeScrapedProducts(a, b)
    expect(m.title).toBe("Primary")
    expect(m.description).toBe("From OG")
    expect(m.images).toEqual(["https://a.test/1.jpg", "https://b.test/2.jpg"])
    expect(m.videos).toEqual(["https://cdn.test/v.mp4"])
    expect(m.variants).toHaveLength(1)
    expect(m.specs.Material).toBe("Cotton")
    expect(m.price).toBe(10)
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
