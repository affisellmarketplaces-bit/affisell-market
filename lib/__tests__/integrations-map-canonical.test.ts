import { describe, expect, it } from "vitest"

import { canonicalToMappedProduct } from "@/lib/integrations/map-canonical-product"
import type { CanonicalProduct } from "@/lib/integrations/types"
import { providerEnumFromSlug, providerSlugFromEnum } from "@/lib/integrations/types"

describe("integrations map-canonical-product", () => {
  it("maps canonical Shopify product to Affisell row with content hash", () => {
    const canonical: CanonicalProduct = {
      externalId: "12345",
      title: "Test Hoodie",
      descriptionHtml: "<p>Warm fleece</p>",
      handle: "test-hoodie",
      vendor: "Acme",
      productType: "Apparel",
      priceCents: 4999,
      inventoryQuantity: 12,
      images: [{ url: "https://cdn.shopify.com/img.jpg", alt: "Front" }],
      variants: [
        {
          externalId: "999",
          sku: "HOODIE-M",
          title: "M",
          priceCents: 4999,
          inventory: 12,
        },
      ],
      options: [{ name: "Size", values: ["M"] }],
      raw: { id: "gid://shopify/Product/12345" },
    }

    const mapped = canonicalToMappedProduct(canonical, "demo.myshopify.com")
    expect(mapped.externalId).toBe("12345")
    expect(mapped.name).toBe("Test Hoodie")
    expect(mapped.basePriceCents).toBe(4999)
    expect(mapped.stock).toBe(12)
    expect(mapped.contentHash.length).toBeGreaterThan(10)
    expect(mapped.images[0]).toContain("cdn.shopify.com")
  })
})

describe("integrations provider slugs", () => {
  it("round-trips shopify slug", () => {
    expect(providerEnumFromSlug("shopify")).toBe("SHOPIFY")
    expect(providerSlugFromEnum("SHOPIFY")).toBe("shopify")
  })
})
