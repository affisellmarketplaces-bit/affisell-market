import { describe, expect, it } from "vitest"

import {
  buildDropForgeProductPersistFields,
  mergeScrapedProducts,
  scrapedToVariantInputs,
  type DropForgeCompletePreview,
} from "@/lib/dropforge-complete-import"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"

function baseScraped(partial: Partial<SupplierScrapedProduct> = {}): SupplierScrapedProduct {
  return {
    title: "SD Card",
    description: "Desc",
    ai_title: "SD Card",
    ai_description: "Desc",
    price: 1,
    original_price: 1,
    currency: "EUR",
    images: ["https://cdn.example.com/a.jpg"],
    videos: [],
    variants: [],
    colors: [],
    sizes: [],
    brand: "",
    category: "AliExpress",
    sku: "ae-1",
    stock: 10,
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
    source_url: "https://www.aliexpress.com/item/1.html",
    basePrice: 2.5,
    costPrice: 1,
    suggested_price: 2.5,
    suggested_commission: 25,
    profit_per_sale: 1.5,
    roi: 150,
    tags: [],
    quality_score: 70,
    is_duplicate: false,
    seo_keywords: [],
    ...partial,
  }
}

describe("dropforge full fidelity", () => {
  it("unions specs when merging scraped products", () => {
    const merged = mergeScrapedProducts(
      baseScraped({ specs: { power: "450W" } }),
      baseScraped({ specs: { material: "ABS", power: "should-lose" } })
    )
    expect(merged.specs.power).toBe("450W")
    expect(merged.specs.material).toBe("ABS")
  })

  it("preserves size + sku + customData image from AE-style variant rows", () => {
    const inputs = scrapedToVariantInputs({
      variants: [
        {
          name: "Black · 128GB",
          type: "Variant",
          image: "//ae01.alicdn.com/kf/black.jpg",
          price: 1.2,
          stock: 5,
          sku: "1200001",
          attributes: { Couleur: "Black", Taille: "128GB" },
        },
        {
          name: "Black · 256GB",
          type: "Variant",
          image: "https://ae01.alicdn.com/kf/black2.jpg",
          price: 1.8,
          stock: 3,
          sku: "1200002",
          attributes: { Couleur: "Black", Taille: "256GB" },
        },
      ],
      colors: [],
      sizes: [],
      costPrice: 1,
      suggestedPrice: 2.5,
      stock: 8,
    })
    expect(inputs.length).toBe(2)
    expect(inputs[0]?.size).toBe("128GB")
    expect(inputs[0]?.sku).toBe("1200001")
    expect(inputs[0]?.customData?.image).toMatch(/^https:\/\//)
    expect(inputs[1]?.size).toBe("256GB")
  })

  it("prefers skuVariants gold path on persist", () => {
    const preview: DropForgeCompletePreview = {
      title: "Lenovo Micro SD",
      description: "UHS-I",
      images: ["https://cdn.example.com/a.jpg"],
      videos: [],
      variants: [
        {
          name: "lossy",
          type: "Variant",
          image: "",
          price: 1,
          stock: 1,
          sku: "bad",
          attributes: {},
        },
      ],
      colors: [],
      sizes: [],
      specs: { capacity: "128GB", speed: "V30" },
      shipping: {
        from_country: "China",
        delivery_time: "15-25",
        shipping_cost: 0,
        carrier: "",
      },
      tags: [],
      seoKeywords: [],
      sku: "ae-1",
      originalPrice: 2,
      reviewCount: 0,
      reviewRating: 0,
      costPrice: 1,
      suggestedPrice: 1.5,
      profitPerSale: 0.5,
      currency: "EUR",
      brand: "Lenovo",
      category: "AliExpress",
      stock: 10,
      platform: "aliexpress",
      marketplaceLabel: "AliExpress",
      method: "aliexpress-api",
      sourceUrl: "https://www.aliexpress.com/item/1.html",
      warnings: [],
      skuVariants: {
        hasVariants: true,
        variants: [
          {
            color: "Black",
            size: "128GB",
            sku: "1200001",
            supplierPrice: 1.2,
            publicPrice: 1.2,
            stock: 5,
            commissionRate: 15,
            customData: { aeLabel: "Black · 128GB", image: "https://ae01.alicdn.com/a.jpg" },
            weightGrams: null,
            ean: null,
            originCountry: "CN",
            warehouseCode: null,
            videoUrl: null,
            processingDays: 2,
          },
          {
            color: "Black",
            size: "256GB",
            sku: "1200002",
            supplierPrice: 1.8,
            publicPrice: 1.8,
            stock: 3,
            commissionRate: 15,
            customData: { aeLabel: "Black · 256GB" },
            weightGrams: null,
            ean: null,
            originCountry: "CN",
            warehouseCode: null,
            videoUrl: null,
            processingDays: 2,
          },
        ],
        colors: ["Black"],
        colorImages: [{ color: "Black", hex: "#111", image: "https://ae01.alicdn.com/a.jpg" }],
        totalStock: 8,
      },
    }
    const persist = buildDropForgeProductPersistFields(preview)
    expect(persist.variantInputs).toHaveLength(2)
    expect(persist.variantInputs[0]?.size).toBe("128GB")
    expect(persist.variantInputs[0]?.sku).toBe("1200001")
    expect(persist.attributes.some((a) => a.key === "capacity")).toBe(true)
    expect(persist.colors).toContain("Black")
    expect(persist.stock).toBe(8)
  })
})
