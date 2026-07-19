import { describe, expect, it } from "vitest"

import { toStandardGMCFeed, gmcFeedId } from "@/lib/radar/writers/gmc-mapper"
import {
  currencyForCountry,
  normalizeBrand,
  normalizeCurrency,
  normalizeFromSnapshot,
  normalizeTitle,
  parsePrice,
  pickImageUrl,
} from "@/lib/radar/writers/standard-product-normalize"

describe("StandardProduct normalization", () => {
  it("normalizes title to Title Case max 150", () => {
    const long = "a".repeat(200)
    const title = normalizeTitle(`  hello WORLD   product  ${long}`)
    expect(title.startsWith("Hello World Product")).toBe(true)
    expect(title.length).toBeLessThanOrEqual(150)
  })

  it("brand fallback Generic + capitalize first letter", () => {
    expect(normalizeBrand(null)).toBe("Generic")
    expect(normalizeBrand("")).toBe("Generic")
    expect(normalizeBrand("nike")).toBe("Nike")
  })

  it("maps currency by country FR→EUR US→USD MX→MXN", () => {
    expect(currencyForCountry("FR")).toBe("EUR")
    expect(currencyForCountry("US")).toBe("USD")
    expect(currencyForCountry("MX")).toBe("MXN")
    expect(normalizeCurrency(null, "FR")).toBe("EUR")
    expect(normalizeCurrency("usd", "FR")).toBe("USD")
  })

  it("parses price and rejects invalid", () => {
    expect(parsePrice("19.99")).toBe(19.99)
    expect(parsePrice("$12.50")).toBe(12.5)
    expect(parsePrice("abc")).toBe(0)
    expect(parsePrice(null)).toBe(0)
  })

  it("image fallback to first https candidate", () => {
    expect(pickImageUrl(null, ["not-a-url", "https://cdn.example.com/a.jpg"])).toBe(
      "https://cdn.example.com/a.jpg"
    )
    expect(pickImageUrl("http://cdn.example.com/b.jpg")).toBe("https://cdn.example.com/b.jpg")
  })

  it("builds normalized product from snapshot", () => {
    const n = normalizeFromSnapshot({
      title: "wireless earbuds pro",
      price: "29.90",
      currency: null,
      imageUrl: null,
      images: ["https://img.example.com/x.png"],
      brand: null,
      marketplaceId: "amazon",
      country: "fr",
      externalId: "B0TEST123",
      url: "https://www.amazon.fr/dp/B0TEST123",
    })
    expect(n).not.toBeNull()
    expect(n!.title).toBe("Wireless Earbuds Pro")
    expect(n!.brand).toBe("Generic")
    expect(n!.currency).toBe("EUR")
    expect(n!.price).toBe(29.9)
    expect(n!.availability).toBe("in_stock")
    expect(n!.condition).toBe("new")
    expect(n!.mpn).toBe("B0TEST123")
    expect(n!.imageUrl).toBe("https://img.example.com/x.png")
    expect(n!.description).toContain("amazon")
    expect(n!.description).toContain("FR")
  })

  it("marks out_of_stock when price <= 0", () => {
    const n = normalizeFromSnapshot({
      title: "x",
      price: 0,
      marketplaceId: "amazon",
      country: "US",
      externalId: "1",
    })
    expect(n!.availability).toBe("out_of_stock")
    expect(n!.currency).toBe("USD")
  })
})

describe("GMC mapper", () => {
  it("builds TSV with id marketplaceId:externalId:country", () => {
    const n = normalizeFromSnapshot({
      title: "led strip",
      price: 10,
      currency: "USD",
      marketplaceId: "tiktok_shop",
      country: "US",
      externalId: "SKU9",
      url: "https://shop.example.com/p/SKU9",
      imageUrl: "https://cdn.example.com/p.jpg",
      brand: "acme",
    })!
    expect(gmcFeedId(n)).toBe("tiktok_shop:SKU9:US")
    const tsv = toStandardGMCFeed([n], "tsv")
    expect(tsv.split("\n")[0]).toContain("image_link")
    expect(tsv).toContain("tiktok_shop:SKU9:US")
    expect(tsv).toContain("10.00 USD")
    expect(tsv).toContain("Acme")
  })
})
