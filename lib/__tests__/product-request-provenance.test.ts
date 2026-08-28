import { describe, expect, it } from "vitest"

import {
  parseProductRequestComplianceRequirements,
  parseProductRequestProvenance,
  parseProductRequestProvenanceCountries,
  productRequestHasFlexibleProvenance,
  PRODUCT_REQUEST_COMPLIANCE_IDS,
  PRODUCT_REQUEST_PROVENANCE_OPTIONS,
  provenanceNotifLabelFr,
  resolveProductRequestProvenanceCountries,
} from "@/lib/product-request-types"

describe("parseProductRequestProvenance", () => {
  it("defaults unknown values to any", () => {
    expect(parseProductRequestProvenance(undefined)).toBe("any")
    expect(parseProductRequestProvenance("")).toBe("any")
    expect(parseProductRequestProvenance("mars")).toBe("any")
  })

  it("accepts all configured ids case-insensitively", () => {
    for (const { id } of PRODUCT_REQUEST_PROVENANCE_OPTIONS) {
      expect(parseProductRequestProvenance(id)).toBe(id)
      expect(parseProductRequestProvenance(id.toUpperCase())).toBe(id)
    }
  })
})

describe("parseProductRequestProvenanceCountries", () => {
  it("allows empty selection (flexible origin)", () => {
    expect(parseProductRequestProvenanceCountries([])).toEqual([])
    expect(parseProductRequestProvenanceCountries(undefined)).toEqual([])
  })

  it("normalizes and deduplicates ISO2 codes", () => {
    expect(parseProductRequestProvenanceCountries(["cn", "CN", " us ", "FR"])).toEqual([
      "CN",
      "FR",
      "US",
    ])
  })

  it("resolves legacy eu bucket when provenanceCountries empty", () => {
    const codes = resolveProductRequestProvenanceCountries({
      provenanceCountries: [],
      sourceProvenance: "eu",
    })
    expect(codes.length).toBeGreaterThan(20)
    expect(codes).toContain("FR")
  })

  it("prefers explicit provenanceCountries over legacy bucket", () => {
    expect(
      resolveProductRequestProvenanceCountries({
        provenanceCountries: ["VN"],
        sourceProvenance: "china",
      })
    ).toEqual(["VN"])
  })

  it("detects flexible provenance", () => {
    expect(
      productRequestHasFlexibleProvenance({
        provenanceCountries: [],
        sourceProvenance: "any",
      })
    ).toBe(true)
    expect(
      productRequestHasFlexibleProvenance({
        provenanceCountries: ["CN"],
        sourceProvenance: "any",
      })
    ).toBe(false)
  })

  it("builds supplier notification label from countries", () => {
    expect(
      provenanceNotifLabelFr({
        provenanceCountries: ["CN", "VN"],
        sourceProvenance: "any",
      })
    ).toBe("CN, VN")
  })
})

describe("parseProductRequestComplianceRequirements", () => {
  it("filters unknown ids", () => {
    expect(parseProductRequestComplianceRequirements(["ce_marking", "nope"])).toEqual([
      "ce_marking",
    ])
  })

  it("accepts all configured compliance ids", () => {
    expect(parseProductRequestComplianceRequirements([...PRODUCT_REQUEST_COMPLIANCE_IDS])).toEqual([
      ...PRODUCT_REQUEST_COMPLIANCE_IDS,
    ])
  })
})
