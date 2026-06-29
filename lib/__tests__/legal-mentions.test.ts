import { describe, expect, it } from "vitest"

import { readCompanyLegal } from "@/lib/legal/company-env"
import {
  EU_CONSUMER_ODR_URL,
  formatVatIntracommunautaire,
  VERCEL_HOST_LEGAL,
} from "@/lib/legal/mentions-constants"

describe("legal-mentions", () => {
  it("defaults DPO to dpo@affisell.com", () => {
    const c = readCompanyLegal()
    expect(c.dpoEmail).toBe("dpo@affisell.com")
  })

  it("uses mediation TODO placeholders until configured", () => {
    const c = readCompanyLegal()
    expect(c.mediatorName).toBe("TODO_MEDIATEUR_NOM")
    expect(c.mediatorUrl).toBe("TODO_SITE")
  })

  it("uses domiciliation address for registered office display", () => {
    const c = readCompanyLegal()
    expect(c.domiciliationAddress).toBeTruthy()
  })

  it("formats Vercel US host for LCEN", () => {
    expect(VERCEL_HOST_LEGAL.name).toBe("Vercel Inc.")
    expect(VERCEL_HOST_LEGAL.street).toContain("Lemon")
  })

  it("exposes EU ODR platform URL", () => {
    expect(EU_CONSUMER_ODR_URL).toBe("https://ec.europa.eu/consumers/odr")
  })

  it("formats FR VAT number", () => {
    expect(formatVatIntracommunautaire("12345678901")).toMatch(/^FR/)
  })
})
