import { describe, expect, it } from "vitest"

import {
  calculateGhostSellPriceEur,
  isGhostPriceDriftCritical,
  supplierPriceDriftRatio,
} from "@/lib/ghost/price-sync"
import { detectGhostSupplierSource } from "@/lib/ghost/supplier-adapters"

describe("ghost price-sync", () => {
  it("marks >15% supplier drift as critical", () => {
    expect(supplierPriceDriftRatio(10, 12)).toBeCloseTo(0.2)
    expect(isGhostPriceDriftCritical(10, 12)).toBe(true)
    expect(isGhostPriceDriftCritical(10, 10.5)).toBe(false)
  })

  it("calculates psychological sell price", () => {
    const sell = calculateGhostSellPriceEur(10)
    expect(sell).toBeGreaterThan(10)
  })
})

describe("ghost supplier detect", () => {
  it("detects marketplace from URL", () => {
    expect(
      detectGhostSupplierSource("https://www.aliexpress.com/item/1.html", null)
    ).toBe("aliexpress")
    expect(detectGhostSupplierSource("https://www.temu.com/g-1.html", null)).toBe("temu")
    expect(detectGhostSupplierSource("https://www.amazon.fr/dp/B0X", null)).toBe("amazon")
  })
})
