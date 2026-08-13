import { describe, expect, it } from "vitest"

import {
  buildAeLabelImageAtlas,
  hydrateAeSkuRowImages,
} from "@/lib/fulfillment/ae-sku-image-hydrate"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"

describe("ae-sku-image-hydrate", () => {
  it("maps human labels to swatch URLs from color swatches", () => {
    const rows: AeProductSkuRow[] = [
      {
        aeSkuId: "1",
        aeLabel: "60mm Red",
        matchColor: "60mm red",
        matchSize: null,
        aePriceCents: 459,
        stock: 7,
      },
      {
        aeSkuId: "2",
        aeLabel: "50mm Blue",
        matchColor: "50mm blue",
        matchSize: null,
        aePriceCents: 459,
        stock: 3,
      },
    ]

    const hydrated = hydrateAeSkuRowImages(rows, {
      colorSwatches: [
        { name: "60mm Red", image: "//ae01.alicdn.com/kf/red-60.jpg" },
        { name: "50mm Blue", image: "https://ae01.alicdn.com/kf/blue-50.jpg" },
      ],
    })

    expect(hydrated[0]?.imageUrl).toContain("red-60.jpg")
    expect(hydrated[1]?.imageUrl).toContain("blue-50.jpg")
  })

  it("builds atlas from variant rows with images", () => {
    const atlas = buildAeLabelImageAtlas({
      variantRows: [{ name: "55mm Black", image: "https://ae01.alicdn.com/kf/black.jpg" }],
    })
    expect(atlas.get("55mm black")).toContain("black.jpg")
  })
})
