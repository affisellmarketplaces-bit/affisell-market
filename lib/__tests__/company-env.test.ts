import { describe, expect, it } from "vitest"

import { deriveSirenFromSiret, readCompanyLegal } from "@/lib/legal/company-env"

describe("company-env", () => {
  it("derives SIREN from SIRET", () => {
    expect(deriveSirenFromSiret("91312345600012")).toBe("913123456")
  })

  it("readCompanyLegal returns unified shape", () => {
    const c = readCompanyLegal()
    expect(c.name).toBeTruthy()
    expect(c.supportEmail).toContain("@")
    expect(c.mediatorUrl).toBeTruthy()
    if (c.mediatorUrl !== "TODO_SITE") {
      expect(c.mediatorUrl).toMatch(/^https?:\/\//)
    }
  })
})

describe("applyLegalPlaceholders", () => {
  it("replaces markdown tokens", async () => {
    const { applyLegalPlaceholders } = await import("@/lib/legal/entity")
    const out = applyLegalPlaceholders("SIREN {{SIREN}} — {{EMAIL}}", "2026-06-04")
    expect(out).not.toContain("{{SIREN}}")
    expect(out).toContain("@")
  })
})
