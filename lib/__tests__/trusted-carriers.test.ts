import { describe, expect, it } from "vitest"

import {
  afterShipSlugForTrustedCarrier,
  defaultTrustedCarrierLabel,
  isTrustedCarrierLabelForCountry,
  trustedCarrierLabelsForCountry,
} from "@/lib/trusted-carriers-shared"
import { resolveShipTrackingPolicy } from "@/lib/ship-tracking-policy.shared"

describe("trusted-carriers-shared", () => {
  it("returns France carriers for FR", () => {
    expect(trustedCarrierLabelsForCountry("FR")).toContain("Colissimo")
    expect(trustedCarrierLabelsForCountry("fr")).toContain("Chronopost")
  })

  it("returns US carriers for US", () => {
    expect(trustedCarrierLabelsForCountry("US")).toEqual(
      expect.arrayContaining(["USPS", "UPS", "FedEx"])
    )
  })

  it("falls back to EU default for unknown ISO2", () => {
    expect(trustedCarrierLabelsForCountry("XX")).toContain("DHL")
  })

  it("maps Colissimo to AfterShip slug", () => {
    expect(afterShipSlugForTrustedCarrier("Colissimo")).toBe("colissimo")
  })

  it("validates carrier against country list", () => {
    expect(isTrustedCarrierLabelForCountry("FR", "Colissimo")).toBe(true)
    expect(isTrustedCarrierLabelForCountry("FR", "USPS")).toBe(false)
    expect(isTrustedCarrierLabelForCountry("FR", "Autre")).toBe(true)
  })

  it("rejects Autre when strict ship tracking is enforced", () => {
    const strict = resolveShipTrackingPolicy({ nodeEnv: "production", afterShipApiKey: "" })
    expect(isTrustedCarrierLabelForCountry("FR", "Autre", strict)).toBe(false)
    expect(trustedCarrierLabelsForCountry("FR", strict)).not.toContain("Autre")
  })

  it("defaults to first trusted carrier per country", () => {
    expect(defaultTrustedCarrierLabel("FR")).toBe("Colissimo")
    expect(defaultTrustedCarrierLabel("US")).toBe("USPS")
  })
})
