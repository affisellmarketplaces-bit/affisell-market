import { describe, expect, it } from "vitest"

import { newVariantRowId } from "@/lib/product-variants"
import {
  buildVariantLabelsFromColorsAndSizes,
  syncVariantRowsFromSimpleColors,
} from "@/lib/supplier-variant-row-sync"

describe("supplier-variant-row-sync", () => {
  it("builds color-only labels without sizes", () => {
    expect(buildVariantLabelsFromColorsAndSizes(["Noir", "Kaki"], [])).toEqual(["Noir", "Kaki"])
  })

  it("builds color × size matrix labels", () => {
    expect(buildVariantLabelsFromColorsAndSizes(["Noir"], ["S", "M"])).toEqual(["Noir / S", "Noir / M"])
  })

  it("creates rows from simple colors and expands color-only row when sizes added", () => {
    const { rows: first } = syncVariantRowsFromSimpleColors({
      simpleColorRows: [{ name: "Noir+Rou", image: "" }],
      sizesText: "",
      existingRows: [],
      defaultRow: () => ({
        id: newVariantRowId(),
        name: "",
        sku: "",
        priceCents: 0,
        stock: 5,
        commission: 15,
        sales: 0,
      }),
    })
    expect(first).toHaveLength(1)
    expect(first[0]!.name).toBe("Noir+Rou")
    expect(first[0]!.stock).toBe(5)

    const { rows: expanded } = syncVariantRowsFromSimpleColors({
      simpleColorRows: [{ name: "Noir+Rou", image: "https://img.test/1.jpg" }],
      sizesText: "S, M",
      existingRows: first,
      defaultRow: () => ({
        id: newVariantRowId(),
        name: "",
        sku: "",
        priceCents: 0,
        stock: 0,
        commission: 15,
        sales: 0,
      }),
    })
    expect(expanded).toHaveLength(2)
    expect(expanded[0]!.id).toBe(first[0]!.id)
    expect(expanded[0]!.name).toBe("Noir+Rou / S")
    expect(expanded[0]!.stock).toBe(5)
    expect(expanded[1]!.name).toBe("Noir+Rou / M")
    expect(expanded[0]!.image).toBe("https://img.test/1.jpg")
  })

  it("keeps manual extra SKU rows not tied to a color", () => {
    const extraId = newVariantRowId()
    const { rows } = syncVariantRowsFromSimpleColors({
      simpleColorRows: [{ name: "Noir", image: "" }],
      sizesText: "",
      existingRows: [
        {
          id: extraId,
          name: "Pack duo",
          sku: "PACK",
          priceCents: 1000,
          stock: 2,
          commission: 20,
          sales: 0,
        },
      ],
      defaultRow: () => ({
        id: newVariantRowId(),
        name: "",
        sku: "",
        priceCents: 0,
        stock: 0,
        commission: 15,
        sales: 0,
      }),
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]!.name).toBe("Noir")
    expect(rows[1]!.id).toBe(extraId)
    expect(rows[1]!.sku).toBe("PACK")
  })
})
