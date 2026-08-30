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

  it("uses v2 hub when env on (Pro default via shell URL)", () => {
    expect(resolveProductWizardVersion({ envEnabled: true })).toBe("v2")
  })

  it("uses v2 with explicit wizard=v2 or mode=express", () => {
    expect(resolveProductWizardVersion({ wizardQuery: "v2" })).toBe("v2")
    expect(resolveProductWizardVersion({ wizardQuery: "v2", modeQuery: "pro" })).toBe("v2")
    expect(resolveProductWizardVersion({ modeQuery: "express" })).toBe("v2")
  })

  it("forces v1 with ?wizard=v1", () => {
    expect(resolveProductWizardVersion({ wizardQuery: "v1", envEnabled: true })).toBe("v1")
  })

  it("mode=pro selects v2 hub (Pro tab) even without wizard=v2 query", () => {
    expect(resolveProductWizardVersion({ modeQuery: "pro", envEnabled: false })).toBe("v2")
  })

  it("forces v2 with ?wizard=v2 even if env off", () => {
    expect(resolveProductWizardVersion({ wizardQuery: "v2", envEnabled: false })).toBe("v2")
  })

  it("reads ENABLE_WIZARD_V2 env", () => {
    expect(isWizardV2EnvEnabled({ ENABLE_WIZARD_V2: "1" })).toBe(true)
    expect(isWizardV2EnvEnabled({ ENABLE_WIZARD_V2: "true" })).toBe(true)
    expect(isWizardV2EnvEnabled({})).toBe(false)
  })

  it("defaults to pro — Express is opt-in", () => {
    expect(resolveWizardV2Mode(null)).toBe("pro")
    expect(resolveWizardV2Mode("pro")).toBe("pro")
    expect(resolveWizardV2Mode("express")).toBe("express")
    expect(resolveWizardV2Mode("guided")).toBe("pro")
    expect(resolveWizardV2Mode("instantscan")).toBe("pro")
  })
})
