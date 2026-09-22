import { describe, expect, it } from "vitest"

import {
  afterShipSlugForTrustedCarrier,
  defaultTrustedCarrierLabel,
  isTrustedCarrierLabelForCountry,
  trustedCarrierGroupsForCountry,
  trustedCarrierLabelsForCountry,
} from "@/lib/trusted-carriers-shared"
import { EU27_COUNTRY_CODES } from "@/lib/shipping/carriers-europe"
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

  it("has a real, country-specific carrier list for every EU27 market — none silently falls back to the generic EU default", () => {
    for (const cc of EU27_COUNTRY_CODES) {
      const labels = trustedCarrierLabelsForCountry(cc)
      expect(labels.length, `${cc} should have dedicated carriers`).toBeGreaterThanOrEqual(3)
      // A destination-specific list always carries at least one carrier that isn't one of the big pan-European names.
      expect(
        labels.some((l) => !/^(DHL|UPS|FedEx|DPD.*|GLS.*)$/i.test(l)),
        `${cc} should offer at least one local/national carrier, not just global networks`
      ).toBe(true)
    }
  })

  it("gives Ireland its own postal operator instead of the UK's Royal Mail", () => {
    expect(trustedCarrierLabelsForCountry("IE")).toContain("An Post")
    expect(trustedCarrierLabelsForCountry("IE")).not.toContain("Royal Mail")
  })

  it("covers newly added Central/Eastern European and Baltic destinations", () => {
    expect(trustedCarrierLabelsForCountry("CZ")).toContain("Česká pošta")
    expect(trustedCarrierLabelsForCountry("PL")).toContain("Poczta Polska")
    expect(trustedCarrierLabelsForCountry("RO")).toContain("Poșta Română")
    expect(trustedCarrierLabelsForCountry("EE")).toContain("Omniva Estonia")
  })

  it("groups carriers into national operators vs pan-European networks for the picker", () => {
    const groups = trustedCarrierGroupsForCountry("FR")
    expect(groups.national.map((c) => c.label)).toContain("Colissimo")
    expect(groups.network.map((c) => c.label)).toEqual(expect.arrayContaining(["UPS", "DHL"]))
  })
})
