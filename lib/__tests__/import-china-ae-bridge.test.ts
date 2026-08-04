import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/product-import-agent", () => ({
  runProductImportAgent: vi.fn(),
}))

import { tryImportChinaViaAgent } from "@/lib/import-china-ae-bridge"
import { runProductImportAgent } from "@/lib/product-import-agent"

describe("import-china-ae-bridge", () => {
  it("returns null for non-AliExpress URLs", async () => {
    const res = await tryImportChinaViaAgent({
      url: "https://mystore.myshopify.com/products/foo",
    })
    expect(res).toBeNull()
    expect(runProductImportAgent).not.toHaveBeenCalled()
  })

  it("routes AliExpress through the import agent", async () => {
    vi.mocked(runProductImportAgent).mockResolvedValue({
      ok: true,
      marketplace: {
        id: "aliexpress",
        label: "AliExpress",
        scrapePlatform: "aliexpress",
        preferAliExpressApi: true,
      },
      product: {
        title: "Test AE",
        description: "Desc",
        ai_title: "Test AE",
        ai_description: "Desc",
        price: 10,
        original_price: 10,
        currency: "EUR",
        images: ["https://cdn/a.jpg"],
        videos: [],
        variants: [],
        colors: [],
        sizes: [],
        brand: "",
        category: "AliExpress",
        sku: "ae-1",
        stock: 5,
        shipping: {
          from_country: "China",
          delivery_time: "15-25 days",
          shipping_cost: 0,
          carrier: "",
        },
        reviews: {
          total: 0,
          average_rating: 0,
          breakdown: {},
          items: [],
          sentiment: "neutral",
        },
        specs: {},
        source_platform: "aliexpress",
        source_url: "https://www.aliexpress.com/item/1005008719608144.html",
        basePrice: 25,
        costPrice: 10,
        suggested_price: 25,
        suggested_commission: 25,
        profit_per_sale: 15,
        roi: 150,
        tags: [],
        quality_score: 70,
        is_duplicate: false,
        seo_keywords: [],
      },
      platform: "aliexpress",
      method: "aliexpress-api",
      warnings: [],
      steps: ["detect", "fetch", "done"],
      aiEnriched: false,
      category: { leafId: "leaf-1", breadcrumb: "Home > Tools", confidence: 0.8, reason: "test" },
      skuVariants: null,
    })

    const res = await tryImportChinaViaAgent({
      url: "https://www.aliexpress.com/item/1005008719608144.html",
    })
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const json = (await res!.json()) as {
      products: Array<{ title: string; categoryId?: string }>
      method: string
    }
    expect(json.method).toBe("aliexpress-api")
    expect(json.products[0]?.title).toBe("Test AE")
    expect(json.products[0]?.categoryId).toBe("leaf-1")
  })
})
