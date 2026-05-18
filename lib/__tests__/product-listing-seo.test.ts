import { describe, expect, it } from "vitest"

import { buildProductListingMetadata, buildProductOfferJsonLd } from "@/lib/product-listing-seo"

describe("buildProductListingMetadata", () => {
  it("strips margin/commission from customer-facing copy", () => {
    const meta = buildProductListingMetadata({
      name: "Produit test — Marge 12€ commission 15%",
      description: "Wholesale base price pour affiliés",
      priceCents: 1999,
      customerFacing: true,
    })
    const title = typeof meta.title === "string" ? meta.title : ""
    const desc = meta.description ?? ""
    expect(title.toLowerCase()).not.toContain("marge")
    expect(title.toLowerCase()).not.toContain("commission")
    expect(desc.toLowerCase()).not.toContain("wholesale")
  })
})

describe("buildProductOfferJsonLd", () => {
  it("emits Product + Offer without commission fields", () => {
    const json = buildProductOfferJsonLd({
      name: "Casque BT",
      priceCents: 4999,
      customerFacing: true,
    })
    expect(json["@type"]).toBe("Product")
    const offers = json.offers as Record<string, unknown>
    expect(offers["@type"]).toBe("Offer")
    expect(JSON.stringify(json).toLowerCase()).not.toContain("commission")
    expect(JSON.stringify(json).toLowerCase()).not.toContain("marge")
  })
})
