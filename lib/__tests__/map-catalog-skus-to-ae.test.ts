import { describe, expect, it } from "vitest"

import {
  applySupplierCatalogSkusToMappingRows,
  normalizeAeSkuCandidate,
  resolveDefaultAeSkuFromProduct,
} from "@/lib/fulfillment/map-catalog-skus-to-ae"

describe("normalizeAeSkuCandidate", () => {
  it("accepts numeric AE sku ids", () => {
    expect(normalizeAeSkuCandidate("1200007633418316")).toBe("1200007633418316")
  })

  it("accepts AE- prefix from imports", () => {
    expect(normalizeAeSkuCandidate("AE-1200007633418316")).toBe("1200007633418316")
  })

  it("rejects Affisell-style catalogue skus", () => {
    expect(normalizeAeSkuCandidate("AFF-BLK-001")).toBeNull()
    expect(normalizeAeSkuCandidate("14:193#Black")).toBeNull()
  })
})

describe("applySupplierCatalogSkusToMappingRows", () => {
  it("fills empty aeSkuId from product variant sku", () => {
    const rows = [
      {
        key: "1",
        productVariantId: "pv1",
        matchColor: "Black",
        matchSize: "",
        aeSkuId: "",
        aePriceCents: 0,
        aeLabel: "",
      },
    ]
    const { rows: next, filled } = applySupplierCatalogSkusToMappingRows(rows, [
      { id: "pv1", color: "Black", size: null, sku: "1200001111222333" },
    ])
    expect(filled).toBe(1)
    expect(next[0]?.aeSkuId).toBe("1200001111222333")
  })
})

describe("resolveDefaultAeSkuFromProduct", () => {
  it("uses product supplierSku when numeric", () => {
    expect(resolveDefaultAeSkuFromProduct("1200009999888777", [])).toBe("1200009999888777")
  })
})
