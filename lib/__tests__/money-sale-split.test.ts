import { describe, expect, it } from "vitest"

import {
  AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS,
  computeSaleSplit,
  resolveLineMarkupCents,
  RESELLER_PLATFORM_FEE_BPS,
  supplierFeeBpsForCategory,
} from "@/lib/money/sale-split"

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("computeSaleSplit — the Affisell money model", () => {
  it("matches the worked example: W 100 €, commission 10 %, markup 30 €, category 10 %", () => {
    const s = computeSaleSplit({ wholesaleCents: 10_000, commissionBps: 1000, markupCents: 3000, supplierFeeBps: 1000 })
    expect(s.commissionCents).toBe(1000)
    expect(s.supplierFeeCents).toBe(1000)
    expect(s.supplierPayoutCents).toBe(8000)
    expect(s.resellerGrossCents).toBe(4000)
    expect(s.resellerFeeCents).toBe(800)
    expect(s.resellerPayoutCents).toBe(3200)
    expect(s.platformFeeCents).toBe(1800)
    expect(s.supplierPayoutCents + s.resellerPayoutCents + s.platformFeeCents).toBe(13_000)
  })

  it("takes the supplier-side commission by category, on the wholesale price", () => {
    const at = (categoryBps: number) =>
      computeSaleSplit({ wholesaleCents: 20_000, commissionBps: 1500, markupCents: 5000, supplierFeeBps: categoryBps })
    expect(at(500).supplierFeeCents).toBe(1000)
    expect(at(1500).supplierFeeCents).toBe(3000)
    expect(at(2000).supplierFeeCents).toBe(4000)
    // the reseller side does not move with the category
    expect(at(500).resellerFeeCents).toBe(at(2000).resellerFeeCents)
  })

  it("takes a flat 20 % of the reseller's HT net (commission + markup)", () => {
    const s = computeSaleSplit({ wholesaleCents: 10_000, commissionBps: 1200, markupCents: 2500, supplierFeeBps: 800 })
    expect(RESELLER_PLATFORM_FEE_BPS).toBe(2000)
    expect(s.resellerFeeCents).toBe(Math.round((1200 + 2500) * 0.2))
  })

  it("charges the reseller fee even when the listing has no markup", () => {
    const s = computeSaleSplit({ wholesaleCents: 10_000, commissionBps: 1000, markupCents: 0, supplierFeeBps: 1000 })
    expect(s.resellerGrossCents).toBe(1000)
    expect(s.resellerFeeCents).toBe(200)
    expect(s.resellerPayoutCents).toBe(800)
  })

  it("adds the auto-buy surcharge on top of the category rate, on the AE wholesale base", () => {
    expect(supplierFeeBpsForCategory({ categoryBps: 1000, usesAffisellAutoBuy: true })).toBe(1000 + AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS)
    expect(supplierFeeBpsForCategory({ categoryBps: 1000, usesAffisellAutoBuy: false })).toBe(1000)
    const s = computeSaleSplit({ wholesaleCents: 10_000, supplierFeeBaseCents: 6000, commissionBps: 1000, markupCents: 3000, supplierFeeBps: 1700 })
    expect(s.supplierFeeCents).toBe(1020)
  })

  it("resolves the markup: fixed listing margin, else collected HT above wholesale", () => {
    expect(resolveLineMarkupCents({ collectedHtCents: 13_000, wholesaleCents: 10_000, fixedListingMarginCents: 2500 })).toBe(2500)
    expect(resolveLineMarkupCents({ collectedHtCents: 13_000, wholesaleCents: 10_000 })).toBe(3000)
    expect(resolveLineMarkupCents({ collectedHtCents: 9_000, wholesaleCents: 10_000 })).toBe(0)
  })

  it("reports the platform-funded part when the collected amount is lower (flash / credit)", () => {
    const base = { wholesaleCents: 10_000, commissionBps: 1000, markupCents: 3000, supplierFeeBps: 1000 }
    expect(computeSaleSplit({ ...base, collectedHtCents: 13_000 }).platformSubsidyCents).toBe(0)
    expect(computeSaleSplit({ ...base, collectedHtCents: 6_500 }).platformSubsidyCents).toBe(11_200 - 6_500)
  })

  it("FUZZ: conserves W + M exactly, never negative, for any inputs", () => {
    const r = rng(2026)
    for (let i = 0; i < 20_000; i++) {
      const wholesale = Math.round(r() * 200_000)
      const s = computeSaleSplit({
        wholesaleCents: wholesale,
        commissionBps: Math.round(r() * 6000),
        markupCents: Math.round(r() * 100_000),
        supplierFeeBps: Math.round(r() * 6000),
        supplierFeeBaseCents: r() < 0.3 ? Math.round(wholesale * r()) : null,
        resellerFeeBps: r() < 0.2 ? Math.round(r() * 6000) : null,
      })
      expect(s.supplierPayoutCents + s.resellerPayoutCents + s.platformFeeCents).toBe(s.listPriceHtCents)
      for (const v of [s.commissionCents, s.supplierFeeCents, s.supplierPayoutCents, s.resellerPayoutCents, s.platformFeeCents]) {
        expect(Number.isInteger(v) && v >= 0).toBe(true)
      }
      expect(s.platformFeeCents).toBe(s.supplierFeeCents + s.resellerFeeCents)
      expect(s.supplierPayoutCents).toBeLessThanOrEqual(s.wholesaleCents)
    }
  }, 30_000)

  it("FUZZ: a higher category rate never lowers Affisell's take nor raises the supplier's payout", () => {
    const r = rng(9)
    for (let i = 0; i < 5_000; i++) {
      const args = { wholesaleCents: Math.round(r() * 100_000), commissionBps: Math.round(r() * 3000), markupCents: Math.round(r() * 50_000) }
      const lo = computeSaleSplit({ ...args, supplierFeeBps: 500 })
      const hi = computeSaleSplit({ ...args, supplierFeeBps: 2000 })
      expect(hi.platformFeeCents).toBeGreaterThanOrEqual(lo.platformFeeCents)
      expect(hi.supplierPayoutCents).toBeLessThanOrEqual(lo.supplierPayoutCents)
      expect(hi.resellerPayoutCents).toBe(lo.resellerPayoutCents)
    }
  })
})
