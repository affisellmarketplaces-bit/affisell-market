import { describe, expect, it } from "vitest"

import {
  MARKETPLACE_CONNECTORS,
  REGION_ORDER,
  groupMarketplacesByRegion,
} from "@/lib/radar/connectors/registry"
import type { Region } from "@/lib/radar/connectors/types"

describe("Radar marketplace registry — world coverage", () => {
  it("covers every continent region", () => {
    const regions = new Set(MARKETPLACE_CONNECTORS.map((c) => c.region))
    for (const region of REGION_ORDER) {
      expect(regions.has(region), `missing region ${region}`).toBe(true)
    }
  })

  it("lists major flagship marketplaces", () => {
    const ids = new Set(MARKETPLACE_CONNECTORS.map((c) => c.id))
    for (const id of [
      "tiktok_shop",
      "amazon",
      "shopify",
      "ebay",
      "walmart",
      "mercadolibre",
      "shopee",
      "lazada",
      "flipkart",
      "rakuten",
      "coupang",
      "tmall",
      "jd",
      "noon",
      "jumia",
      "takealot",
      "amazon_au",
      "trendyol",
      "allegro",
      "temu",
    ]) {
      expect(ids.has(id), `missing connector ${id}`).toBe(true)
    }
  })

  it("groups regions in stable world order", () => {
    const grouped = groupMarketplacesByRegion()
    const keys = [...grouped.keys()] as Region[]
    expect(keys[0]).toBe("GLOBAL")
    expect(keys).toContain("OCEANIA")
    expect(keys).toContain("SOUTH_ASIA")
    expect(keys.indexOf("EU")).toBeLessThan(keys.indexOf("OCEANIA"))
  })

  it("has unique connector ids", () => {
    const ids = MARKETPLACE_CONNECTORS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
