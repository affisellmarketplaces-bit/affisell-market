import { describe, expect, it } from "vitest"

import {
  collectClientPublishBlockers,
  mapServerPublishBlockers,
  publishBlockerStep,
} from "@/lib/supplier-publish-blockers"

describe("supplier-publish-blockers", () => {
  it("collects step-1 blockers", () => {
    const blockers = collectClientPublishBlockers({
      name: "",
      imagesCount: 0,
      categoryId: "",
      missingSpecs: [{ label: "Marque" }],
      priceError: null,
      compareError: null,
      commissionError: null,
      variantFormMode: "none",
      variantRows: [],
      simpleColorRows: [],
    })
    expect(blockers.map((b) => b.field)).toEqual(
      expect.arrayContaining(["name", "images", "category", "specs"])
    )
    expect(publishBlockerStep(blockers[0]!.field)).toBe(1)
  })

  it("maps server spec errors", () => {
    const blockers = mapServerPublishBlockers({
      error: "Validation failed",
      errors: ["Marque est requis", "Couleur est requis"],
    })
    expect(blockers.every((b) => b.field === "specs")).toBe(true)
    expect(blockers).toHaveLength(2)
  })
})
