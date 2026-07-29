import { describe, expect, it } from "vitest"

import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { deriveSirenFromSiret, readCompanyLegal } from "@/lib/legal/company-env"
import { formatVatIntracommunautaire } from "@/lib/legal/mentions-constants"

describe("auto-entreprise legal identity", () => {
  it("derives SIREN from SIRET", () => {
    expect(deriveSirenFromSiret(AFFISELL_LEGAL_IDENTITY.siret)).toBe(
      AFFISELL_LEGAL_IDENTITY.siren
    )
  })

  it("defaults to micro-entreprise SIRET and 293B VAT regime", () => {
    const c = readCompanyLegal()
    expect(c.siret).toBe(AFFISELL_LEGAL_IDENTITY.siret)
    expect(c.legalName).toBe(AFFISELL_LEGAL_IDENTITY.legalName)
    expect(c.naf).toContain("4791B")
    expect(c.vatRegime).toMatch(/293\s*B/i)
  })

  it("formats empty TVA as 293B message", () => {
    expect(formatVatIntracommunautaire("")).toMatch(/293\s*B/i)
  })
})
