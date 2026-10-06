import { afterEach, describe, expect, it, vi } from "vitest"

import { computeHeroStats, heroTagline } from "@/lib/storefront/storefront-hero-stats"

describe("computeHeroStats", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("counts what is really on sale and nothing else", () => {
    const stats = computeHeroStats([
      { priceCents: 12_00, freeShipping: false, soldCount: 2 },
      { priceCents: 149_99, freeShipping: true, soldCount: 31 },
      { priceCents: 60_00, freeShipping: true, sales: { units: 9 } },
    ])
    expect(stats).toEqual({ productCount: 3, topSales: 31, freeShippingCount: 2, klarnaEligible: true })
  })

  it("makes no shipping or Klarna claim when none is true", () => {
    const stats = computeHeroStats([{ priceCents: 9_99 }, { priceCents: 19_99 }])
    expect(stats).toMatchObject({ freeShippingCount: 0, klarnaEligible: false, topSales: 0 })
  })

  it("Klarna is not claimed when BNPL is switched off, whatever the prices", () => {
    vi.stubEnv("MARKETPLACE_BNPL_ENABLED", "0")
    expect(computeHeroStats([{ priceCents: 500_00 }]).klarnaEligible).toBe(false)
  })

  it("an empty catalog is zeros", () => {
    expect(computeHeroStats([])).toEqual({ productCount: 0, topSales: 0, freeShippingCount: 0, klarnaEligible: false })
  })
})

describe("heroTagline", () => {
  it("takes the first sentence only", () => {
    expect(heroTagline("Des essentiels premium. Livrés partout. Retours faciles.")).toBe("Des essentiels premium.")
  })

  it("caps a long sentence without splitting an emoji", () => {
    const long = `${"a".repeat(118)}🔥🔥 and more words after`
    const out = heroTagline(long, 120)!
    expect(out.endsWith("…")).toBe(true)
    expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/)
    expect(out.length).toBeLessThanOrEqual(121)
  })

  it("returns null for nothing to say", () => {
    for (const v of [null, undefined, "", "   \n "]) expect(heroTagline(v)).toBeNull()
  })

  it("collapses whitespace", () => {
    expect(heroTagline("  Une   boutique\n  soignée.  ")).toBe("Une boutique soignée.")
  })
})
