import { describe, expect, it } from "vitest"

import {
  canViewResellerMarketPrice,
  canViewResellerMargin,
  formatSupplierDemandSignal,
  radarPriceColumnLabel,
  redactRadarWinnerForRole,
} from "@/lib/radar/radar-price-veil"
import type { WorldRadarWinnerDto } from "@/lib/radar/world-radar-types"

const sample: WorldRadarWinnerDto = {
  id: "w1",
  countryCode: "FR",
  rank: 1,
  title: "Produit test",
  image: null,
  source: "Affisell",
  price: 608.33,
  currency: "EUR",
  growthRate: 55,
  searches: 8000,
  competition: 3,
  trendingScore: 90,
  category: "home",
}

describe("radar-price-veil", () => {
  it("hides reseller market price for SUPPLIER", () => {
    expect(canViewResellerMarketPrice("SUPPLIER")).toBe(false)
    expect(canViewResellerMargin("SUPPLIER")).toBe(false)
    expect(radarPriceColumnLabel("SUPPLIER")).toBe("Signal")
  })

  it("keeps reseller market price for AFFILIATE", () => {
    expect(canViewResellerMarketPrice("AFFILIATE")).toBe(true)
    expect(radarPriceColumnLabel("AFFILIATE")).toBe("Prix")
  })

  it("redacts winner price server-side for SUPPLIER", () => {
    const redacted = redactRadarWinnerForRole(sample, "SUPPLIER")
    expect(redacted.price).toBeNull()
    expect(redacted.priceVeiled).toBe(true)
    expect(redactRadarWinnerForRole(sample, "AFFILIATE").price).toBe(608.33)
  })

  it("formats demand signal without euro amounts", () => {
    const signal = formatSupplierDemandSignal(sample)
    expect(signal).not.toMatch(/€|608/)
    expect(signal).toMatch(/8k|Zone|recherches|Demande/)
  })
})
