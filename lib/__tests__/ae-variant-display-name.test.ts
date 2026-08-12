import { describe, expect, it } from "vitest"

import {
  humanLabelFromAeSkuAttr,
  resolveAeVariantDisplayColor,
  stripAeSkuTechnicalLabel,
} from "@/lib/fulfillment/ae-variant-display-name"

describe("stripAeSkuTechnicalLabel", () => {
  it("extracts human label after AE hash suffix", () => {
    expect(stripAeSkuTechnicalLabel("14:771#55mm Blue")).toBe("55mm Blue")
    expect(stripAeSkuTechnicalLabel("14:366#40mm Blue")).toBe("40mm Blue")
  })
})

describe("humanLabelFromAeSkuAttr", () => {
  it("extracts human label from hash suffix", () => {
    expect(humanLabelFromAeSkuAttr("14:771#55mm Blue")).toBe("55mm Blue")
  })
})

describe("resolveAeVariantDisplayColor", () => {
  it("prefers attribute labels over numeric ids", () => {
    expect(
      resolveAeVariantDisplayColor(
        {
          aeLabel: "14:771#55mm Blue",
          matchColor: "771",
          attributes: { Color: "55mm Blue" },
        },
        0
      )
    ).toBe("55mm Blue")
  })

  it("falls back to cleaned aeLabel when attributes are numeric", () => {
    expect(
      resolveAeVariantDisplayColor(
        {
          aeLabel: "14:771#55mm Blue",
          matchColor: "771",
          attributes: { Color: "771" },
        },
        4
      )
    ).toBe("55mm Blue")
  })
})
