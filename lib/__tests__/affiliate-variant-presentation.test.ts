import { describe, expect, it } from "vitest"

import {
  applyVariantPresentationToColorImages,
  parseAffiliateVariantPresentationJson,
  serializeVariantPresentationForDb,
  resolveVariantDisplayLabel,
} from "@/lib/affiliate-variant-presentation"

describe("affiliate-variant-presentation", () => {
  it("parses label + image overrides", () => {
    const map = parseAffiliateVariantPresentationJson({
      "Variant 3": { label: "Noir Mat", image: "https://cdn.example/v3.jpg" },
      "Variant 4": { label: "  ", image: "" },
    })
    expect(map["Variant 3"]?.label).toBe("Noir Mat")
    expect(map["Variant 3"]?.image).toContain("cdn.example")
    expect(map["Variant 4"]).toBeUndefined()
  })

  it("serializes only allowed keys and clears empty", () => {
    const serialized = serializeVariantPresentationForDb(
      {
        "Variant 3": { label: "Noir", image: "https://cdn.example/a.jpg" },
        Other: { label: "X" },
      },
      ["Variant 3"]
    )
    expect(serialized).toEqual({
      "Variant 3": { label: "Noir", image: "https://cdn.example/a.jpg" },
    })
    expect(serializeVariantPresentationForDb({}, ["Variant 3"])).toBeNull()
  })

  it("applies image overlay without renaming color keys", () => {
    const rows = applyVariantPresentationToColorImages(
      [{ color: "Variant 3", hex: "#111", image: "" }],
      { "Variant 3": { image: "https://cdn.example/hero.jpg", label: "Noir" } }
    )
    expect(rows[0]?.color).toBe("Variant 3")
    expect(rows[0]?.image).toContain("hero.jpg")
    expect(resolveVariantDisplayLabel({ "Variant 3": { label: "Noir" } }, "Variant 3", "Variant 3")).toBe(
      "Noir"
    )
  })
})
