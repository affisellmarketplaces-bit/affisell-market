import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { CARRIERS, carrierCoversCountry } from "@/lib/shipping/carriers"
import { EUROPE_COUNTRY_CODES, EU27_COUNTRY_CODES } from "@/lib/shipping/carriers-europe"
import {
  parseShippingCarrierIds,
  parseShopShippingOffers,
  resolvePdpShippingOffers,
} from "@/lib/shipping/supplier-carrier-offers-shared"

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const byId = (id: string) => CARRIERS.find((c) => c.id === id)!

describe("European carrier catalog", () => {
  it("has unique ids", () => {
    expect(new Set(CARRIERS.map((c) => c.id)).size).toBe(CARRIERS.length)
  })

  it("serves every European country/territory with at least one carrier", () => {
    const uncovered = [...EUROPE_COUNTRY_CODES].filter((cc) => !CARRIERS.some((c) => carrierCoversCountry(c, cc)))
    expect(uncovered).toEqual([])
  })

  it("never covers RU/BY through Europe-wide carriers", () => {
    for (const cc of ["RU", "BY"]) {
      expect((EUROPE_COUNTRY_CODES as readonly string[]).includes(cc)).toBe(false)
      expect(CARRIERS.filter((c) => c.country.includes("EUROPE") && carrierCoversCountry(c, cc))).toEqual([])
    }
  })

  it("EU-tagged carriers cover EU members only", () => {
    const eu = CARRIERS.find((c) => c.country.includes("EU"))
    if (eu) {
      expect(carrierCoversCountry(eu, "FR")).toBe(true)
      expect(carrierCoversCountry(eu, "CH")).toBe(false)
    }
    expect(EU27_COUNTRY_CODES.length).toBe(27)
  })

  it("tracking links carry the {tracking} placeholder", () => {
    for (const c of CARRIERS.filter((x) => x.id.startsWith("eu_"))) {
      expect(c.tracking_url, c.id).toContain("{tracking}")
    }
  })
})

describe("parseShopShippingOffers", () => {
  it("drops unknown carriers, dedupes, clamps and orders the window", () => {
    const out = parseShopShippingOffers([
      { carrierId: "eu_dhl_parcel", deliveryMin: 9, deliveryMax: 2 },
      { carrierId: "eu_dhl_parcel", deliveryMin: 1, deliveryMax: 1 },
      { carrierId: "nope", deliveryMin: 1, deliveryMax: 2 },
      { carrierId: "eu_gls", deliveryMin: 0, deliveryMax: 500, countries: ["fr", "xx1", "de"] },
    ])
    expect(out.map((o) => o.carrierId)).toEqual(["eu_dhl_parcel", "eu_gls"])
    for (const o of out) {
      expect(o.deliveryMin).toBeGreaterThanOrEqual(1)
      expect(o.deliveryMax).toBeLessThanOrEqual(90)
      expect(o.deliveryMin).toBeLessThanOrEqual(o.deliveryMax)
    }
    expect(out[1].countries).toEqual(["FR", "DE"])
  })

  it("returns [] for garbage", () => {
    expect(parseShopShippingOffers(null)).toEqual([])
    expect(parseShopShippingOffers("x")).toEqual([])
  })

  it("parseShippingCarrierIds keeps only catalog ids", () => {
    expect(parseShippingCarrierIds(["eu_gls", "zzz", 3])).toEqual(["eu_gls"])
  })
})

describe("resolvePdpShippingOffers — nothing shown unless the supplier defined it", () => {
  const shop = [
    { carrierId: "eu_gls", deliveryMin: 2, deliveryMax: 4 },
    { carrierId: "eu_dpd", deliveryMin: 3, deliveryMax: 6 },
    { carrierId: "eu_dhl_parcel", deliveryMin: 1, deliveryMax: 2, countries: ["DE"] },
  ]

  it("has no fallback when the shop defined nothing", () => {
    expect(resolvePdpShippingOffers({ shopOffers: [], productCarrierIds: ["eu_gls"], buyerCountry: "FR" })).toEqual([])
  })

  it("respects per-carrier destinations", () => {
    const fr = resolvePdpShippingOffers({ shopOffers: shop, productCarrierIds: [], buyerCountry: "FR" })
    expect(fr.map((o) => o.carrier.id)).not.toContain("eu_dhl_parcel")
    const de = resolvePdpShippingOffers({ shopOffers: shop, productCarrierIds: [], buyerCountry: "DE" })
    expect(de[0].carrier.id).toBe("eu_dhl_parcel")
    expect(de[0].fastest).toBe(true)
  })

  it("product ids only narrow; no overlap falls back to shop offers, never to the catalog", () => {
    const narrowed = resolvePdpShippingOffers({ shopOffers: shop, productCarrierIds: ["eu_dpd"], buyerCountry: "FR" })
    expect(narrowed.map((o) => o.carrier.id)).toEqual(["eu_dpd"])
    const stray = resolvePdpShippingOffers({ shopOffers: shop, productCarrierIds: ["eu_tnt"], buyerCountry: "FR" })
    expect(stray.map((o) => o.carrier.id).sort()).toEqual(["eu_dpd", "eu_gls"])
  })

  it("uses the supplier's window, not the catalog's", () => {
    const [o] = resolvePdpShippingOffers({ shopOffers: [{ carrierId: "eu_gls", deliveryMin: 7, deliveryMax: 8 }], productCarrierIds: [], buyerCountry: "FR" })
    expect([o.deliveryMin, o.deliveryMax]).toEqual([7, 8])
    expect(o.fastest).toBe(false)
    expect(byId("eu_gls")).toBeTruthy()
  })
})

describe("no invented data on the PDP path", () => {
  it("removed auto-suggestion and reliability display", () => {
    expect(read("lib/shipping/supplier-carrier-offers-shared.ts")).not.toContain("suggestCarrierIdsForProduct")
    expect(read("components/shipping/ProductShippingOptions.tsx")).not.toMatch(/reliability/)
    expect(read("components/supplier/supplier-shipping-carriers-picker.tsx")).not.toMatch(/reliability|suggestCarrierIds/)
    expect(read("app/api/supplier/products/route.ts")).not.toContain("suggestCarrierIdsForProduct")
    expect(read("app/api/supplier/products/[id]/route.ts")).not.toContain("suggestCarrierIdsForProduct")
  })
})
