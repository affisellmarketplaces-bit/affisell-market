import { describe, expect, it } from "vitest"

import { mapLegacyTermsToSupplierSlug } from "../../scripts/migrate-supplier-legacy-acceptance"

describe("mapLegacyTermsToSupplierSlug", () => {
  it("maps conditions-fournisseur prefix", () => {
    expect(mapLegacyTermsToSupplierSlug("conditions-fournisseur:2026-06-04", false)).toBe(
      "supplier"
    )
  })

  it("maps date-prefix terms-supplier when flag enabled", () => {
    expect(
      mapLegacyTermsToSupplierSlug("2026-05-26:terms-supplier", true)
    ).toBe("supplier")
  })

  it("ignores date-prefix without flag", () => {
    expect(mapLegacyTermsToSupplierSlug("2026-05-26:terms-supplier", false)).toBeNull()
  })

  it("ignores unknown legacy formats", () => {
    expect(mapLegacyTermsToSupplierSlug("conditions-affilie:2026-06-25", true)).toBeNull()
  })
})
