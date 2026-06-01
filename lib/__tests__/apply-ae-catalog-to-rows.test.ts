import { describe, expect, it } from "vitest"

import { applyImportedAeCatalogToVariantRows } from "@/lib/fulfillment/apply-ae-catalog-to-rows"
import type { AeVariantMappingRowInput } from "@/lib/fulfillment/apply-ae-variant-suggestions"

describe("applyImportedAeCatalogToVariantRows", () => {
  it("maps Black / Silver / White to three distinct AE SKUs", () => {
    const productVariants = [
      { id: "pv-black", color: "Black", size: null },
      { id: "pv-silver", color: "Silver", size: null },
      { id: "pv-white", color: "White", size: null },
    ]
    const aeSkus = [
      {
        aeSkuId: "1200001111111111",
        aeLabel: "Black",
        matchColor: "black",
        matchSize: null,
        aePriceCents: 750,
        stock: 1,
      },
      {
        aeSkuId: "1200002222222222",
        aeLabel: "Silver",
        matchColor: "silver",
        matchSize: null,
        aePriceCents: 750,
        stock: 1,
      },
      {
        aeSkuId: "1200003333333333",
        aeLabel: "White",
        matchColor: "white",
        matchSize: null,
        aePriceCents: 750,
        stock: 1,
      },
    ]
    const rows: AeVariantMappingRowInput[] = productVariants.map((pv) => ({
      key: pv.id,
      productVariantId: pv.id,
      matchColor: pv.color ?? "",
      matchSize: "",
      aeSkuId: "",
      aePriceCents: 0,
      aeLabel: "",
    }))

    const { rows: next, catalogSize, mappedRows } = applyImportedAeCatalogToVariantRows(
      rows,
      productVariants,
      aeSkus
    )

    expect(catalogSize).toBe(3)
    expect(mappedRows).toBe(3)
    expect(new Set(next.map((r) => r.aeSkuId)).size).toBe(3)
  })
})
