import { describe, expect, it } from "vitest"

import {
  isWizardV2EnvEnabled,
  resolveProductWizardVersion,
  resolveWizardV2Mode,
} from "@/lib/product-wizard-v2/feature-flag"

describe("product-wizard-v2 feature-flag", () => {
  it("defaults to v1 when env off", () => {
    expect(resolveProductWizardVersion({ envEnabled: false })).toBe("v1")
  })

  it("uses v2 when env on", () => {
    expect(resolveProductWizardVersion({ envEnabled: true })).toBe("v2")
  })

  it("forces v1 with ?wizard=v1", () => {
    expect(resolveProductWizardVersion({ wizardQuery: "v1", envEnabled: true })).toBe("v1")
  })

  it("forces v1 with ?mode=pro", () => {
    expect(resolveProductWizardVersion({ modeQuery: "pro", envEnabled: true })).toBe("v1")
  })

  it("forces v2 with ?wizard=v2 even if env off", () => {
    expect(resolveProductWizardVersion({ wizardQuery: "v2", envEnabled: false })).toBe("v2")
  })

  it("reads ENABLE_WIZARD_V2 env", () => {
    expect(isWizardV2EnvEnabled({ ENABLE_WIZARD_V2: "1" })).toBe(true)
    expect(isWizardV2EnvEnabled({ ENABLE_WIZARD_V2: "true" })).toBe(true)
    expect(isWizardV2EnvEnabled({})).toBe(false)
  })

  it("resolves guided mode by default", () => {
    expect(resolveWizardV2Mode(null)).toBe("guided")
    expect(resolveWizardV2Mode("express")).toBe("express")
  })
})
