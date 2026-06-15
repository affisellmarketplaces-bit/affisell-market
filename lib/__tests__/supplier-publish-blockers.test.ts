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
      offerModeAcknowledged: true,
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

  it("maps booking_slots_required to specs step", () => {
    const blockers = mapServerPublishBlockers({ error: "booking_slots_required" })
    expect(blockers).toHaveLength(1)
    expect(blockers[0]?.field).toBe("specs")
    expect(blockers[0]?.message).toContain("créneau")
  })

  it("blocks publish when offer mode was not acknowledged", () => {
    const blockers = collectClientPublishBlockers({
      name: "Test",
      imagesCount: 1,
      categoryId: "cat-1",
      missingSpecs: [],
      priceError: null,
      compareError: null,
      commissionError: null,
      variantFormMode: "none",
      variantRows: [],
      simpleColorRows: [],
      offerModeAcknowledged: false,
    })
    expect(blockers.some((b) => b.field === "offerMode")).toBe(true)
    expect(publishBlockerStep("offerMode")).toBe(3)
  })

  it("blocks publish when warehouse zone is missing", () => {
    const blockers = collectClientPublishBlockers({
      name: "Test",
      imagesCount: 1,
      categoryId: "cat-1",
      missingSpecs: [],
      priceError: null,
      compareError: null,
      commissionError: null,
      variantFormMode: "none",
      variantRows: [],
      simpleColorRows: [],
      offerModeAcknowledged: true,
      warehouseType: "",
    })
    expect(blockers.some((b) => b.field === "warehouseType")).toBe(true)
    expect(publishBlockerStep("warehouseType")).toBe(3)
  })
})
