import { describe, expect, it } from "vitest"

import {
  normalizeWizardV2SearchParams,
  WIZARD_V2_EXPRESS_HREF,
  WIZARD_V2_PRO_HREF,
} from "@/lib/product-wizard-v2/wizard-v2-routes"

describe("wizard-v2 routes", () => {
  it("exposes stable deep links", () => {
    expect(WIZARD_V2_PRO_HREF).toContain("wizard=v2")
    expect(WIZARD_V2_PRO_HREF).toContain("mode=pro")
    expect(WIZARD_V2_EXPRESS_HREF).toContain("mode=express")
  })

  it("normalizes compose + wizard + default pro mode", () => {
    const qs = normalizeWizardV2SearchParams(new URLSearchParams())
    expect(qs.get("compose")).toBe("1")
    expect(qs.get("wizard")).toBe("v2")
    expect(qs.get("mode")).toBe("pro")
  })

  it("preserves explicit express mode", () => {
    const qs = normalizeWizardV2SearchParams(new URLSearchParams("wizard=v2&mode=express&compose=1"))
    expect(qs.get("mode")).toBe("express")
  })
})
