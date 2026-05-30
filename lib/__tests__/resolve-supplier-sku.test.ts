import { describe, expect, it } from "vitest"

import { resolveSupplierSkuForOrder } from "@/lib/fulfillment/resolve-supplier-sku"

describe("resolveSupplierSkuForOrder", () => {
  const defaults = { aeSkuId: "default-sku", aePriceCents: 100, aeShippingCents: 50 }

  it("matches variant mapping by color label", () => {
    const resolved = resolveSupplierSkuForOrder(
      defaults,
      [
        {
          id: "m1",
          productVariantId: null,
          matchColor: "green",
          matchSize: null,
          aeSkuId: "sku-green",
          aePriceCents: 140,
          aeShippingCents: 0,
          aeLabel: "Green",
        },
        {
          id: "m2",
          productVariantId: null,
          matchColor: "black",
          matchSize: null,
          aeSkuId: "sku-black",
          aePriceCents: 130,
          aeShippingCents: 0,
          aeLabel: "Black",
        },
      ],
      { variantLabel: "Green · —", quantity: 1 }
    )
    expect(resolved.aeSkuId).toBe("sku-green")
    expect(resolved.aePriceCents).toBe(140)
    expect(resolved.source).toBe("variant_mapping")
  })

  it("matches French color to AE mapping", () => {
    const resolved = resolveSupplierSkuForOrder(
      defaults,
      [
        {
          id: "m1",
          productVariantId: null,
          matchColor: "green",
          matchSize: null,
          aeSkuId: "sku-vert",
          aePriceCents: 140,
          aeShippingCents: 0,
          aeLabel: "Vert",
        },
      ],
      { variantLabel: "Vert", quantity: 1 }
    )
    expect(resolved.aeSkuId).toBe("sku-vert")
  })

  it("falls back to link default when no mappings", () => {
    const resolved = resolveSupplierSkuForOrder(defaults, [], {
      variantLabel: "Blue",
      quantity: 1,
    })
    expect(resolved.aeSkuId).toBe("default-sku")
    expect(resolved.source).toBe("unmatched")
  })

  it("marks unmatched when mappings exist but color unknown", () => {
    const resolved = resolveSupplierSkuForOrder(
      defaults,
      [
        {
          id: "m1",
          productVariantId: null,
          matchColor: "green",
          matchSize: null,
          aeSkuId: "sku-green",
          aePriceCents: 140,
          aeShippingCents: 0,
          aeLabel: "Green",
        },
      ],
      { variantLabel: "Purple", quantity: 1 }
    )
    expect(resolved.source).toBe("unmatched")
    expect(resolved.aeSkuId).toBe("default-sku")
  })
})
