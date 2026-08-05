import { describe, expect, it } from "vitest"

import {
  buildUrlImportFormPatch,
  GENERIC_BRAND_LABEL,
  mapImportedVariants,
  normalizeImportBrand,
} from "@/lib/url-import-apply"

describe("url-import-apply", () => {
  it("uses Generic for unknown store brands", () => {
    expect(normalizeImportBrand("AliExpress Official Store", "Montre connectée")).toBe(GENERIC_BRAND_LABEL)
    expect(normalizeImportBrand("", "Xiaomi Smart Band 10")).toBe("Xiaomi")
  })

  it("maps shopify-style variants to advanced rows", () => {
    const mapped = mapImportedVariants(
      {
        variants: [
          { name: "S / Black", type: "Variant", price: 29.99, stock: 5, sku: "S-B", image: "", attributes: {} },
          { name: "M / Black", type: "Variant", price: 31.99, stock: 3, sku: "M-B", image: "", attributes: {} },
        ],
      },
      35,
      "20"
    )
    expect(mapped.mode).toBe("advanced")
    expect(mapped.variantRows).toHaveLength(2)
    expect(mapped.variantRows[0]?.priceCents).toBe(2999)
  })

  it("builds patch with brand and videos", () => {
    const patch = buildUrlImportFormPatch(
      {
        title: "Xiaomi Smart Band 10",
        description: "Tracker",
        price: 40,
        stock: 100,
        brand: "Random Shop",
        images: ["https://cdn.example.com/a.jpg"],
        videos: ["https://cdn.example.com/promo.mp4"],
        colors: [{ name: "Noir", image: "", hex: "#000" }],
        sizes: [{ name: "M", value: "M" }],
      },
      { markup: 2, categoryAttrs: [{ key: "brand", label: "Marque" }], commissionPct: "15" }
    )
    expect(patch.brand).toBe("Xiaomi")
    expect(patch.specValuesPatch.brand).toBe("Xiaomi")
    expect(patch.illustrationVideos).toHaveLength(1)
    expect(patch.variants.mode).toBe("simple")
    expect(patch.variants.sizes).toContain("M")
  })

  it("absolutizes protocol-relative AliExpress images", () => {
    const patch = buildUrlImportFormPatch(
      {
        title: "Nettoyeur",
        description: "Desc",
        price: 50,
        images: ["//ae01.alicdn.com/kf/hero.jpg", "https://ae01.alicdn.com/kf/side.jpg"],
        specs: { power: "450W" },
      },
      { markup: 2.5, categoryAttrs: [], commissionPct: "15" }
    )
    expect(patch.images).toEqual([
      "https://ae01.alicdn.com/kf/hero.jpg",
      "https://ae01.alicdn.com/kf/side.jpg",
    ])
    expect(patch.description).toMatch(/450W/)
  })

  it("strips [[img:N]] markers and keeps photos in gallery", () => {
    const markers = Array.from({ length: 8 }, (_, i) => `[[img:${i}]]`).join("\n")
    const patch = buildUrlImportFormPatch(
      {
        title: "Pistolet à eau électrique",
        description: markers,
        price: 7.5,
        images: [
          "https://ae01.alicdn.com/kf/hero.jpg",
          "https://ae01.alicdn.com/kf/detail-0.jpg",
        ],
        descriptionIllustrationImages: [
          "https://ae01.alicdn.com/kf/detail-0.jpg",
          "https://ae01.alicdn.com/kf/detail-1.jpg",
        ],
        specs: { battery: "7.4V", range: "8m" },
      },
      { markup: 2.5, categoryAttrs: [], commissionPct: "15" }
    )
    expect(patch.description).not.toMatch(/\[\[\s*img\s*:/i)
    expect(patch.description).toMatch(/Pistolet|CARACTÉRISTIQUES|battery|7\.4V/i)
    expect(patch.images.length).toBeGreaterThanOrEqual(2)
    expect(patch.illustrationImages).toContain("https://ae01.alicdn.com/kf/detail-1.jpg")
  })

  it("strips OPTIONS blocks from imported descriptions", () => {
    const patch = buildUrlImportFormPatch(
      {
        title: "Tablette",
        description: `Fiche produit\n\nOPTIONS\n• 14:175#Green — 44.59 €\n• 14:1052#Pink — 44.19 €`,
        price: 40,
        images: ["https://ae01.alicdn.com/kf/hero.jpg"],
      },
      { markup: 2.5, categoryAttrs: [], commissionPct: "15" }
    )
    expect(patch.description).not.toMatch(/OPTIONS/i)
    expect(patch.description).not.toMatch(/14:175#Green/)
    expect(patch.description).toMatch(/Fiche produit/)
  })
})
