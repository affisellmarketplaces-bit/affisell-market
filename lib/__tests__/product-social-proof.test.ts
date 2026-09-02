import { describe, expect, it } from "vitest"

import { anonymizeDisplayName } from "@/lib/anonymize-display-name"
import {
  formatLastSaleAgoLine,
  formatRelativeMinutesAgo,
  resolveMarginLeaveOnTableTrigger,
  shouldShowMarginLeaveOnTableTrigger,
  shouldShowProductCrossSocialProof,
} from "@/lib/product-social-proof-shared"

describe("anonymizeDisplayName", () => {
  it("formats first name + last initial", () => {
    expect(anonymizeDisplayName("Marc Dupont")).toBe("Marc D.")
    expect(anonymizeDisplayName("sophie leroy")).toBe("Sophie L.")
  })

  it("handles single names", () => {
    expect(anonymizeDisplayName("Nelson")).toBe("N.")
  })

  it("returns null for empty input", () => {
    expect(anonymizeDisplayName(null)).toBeNull()
    expect(anonymizeDisplayName("  ")).toBeNull()
  })
})

describe("product-social-proof-shared", () => {
  it("shows when resellers or last sale exist", () => {
    expect(
      shouldShowProductCrossSocialProof({
        activeResellersCount: 0,
        avgMarginCents: 0,
        topMarginCents: 0,
        lastSaleAt: null,
        lastSaleResellerLabel: null,
      })
    ).toBe(false)
    expect(
      shouldShowProductCrossSocialProof({
        activeResellersCount: 2,
        avgMarginCents: 1000,
        topMarginCents: 2000,
        lastSaleAt: null,
        lastSaleResellerLabel: null,
      })
    ).toBe(true)
  })

  it("formats last sale line in FR", () => {
    const recent = new Date(Date.now() - 12 * 60_000).toISOString()
    const line = formatLastSaleAgoLine(
      {
        activeResellersCount: 3,
        avgMarginCents: 1720,
        topMarginCents: 4500,
        lastSaleAt: recent,
        lastSaleResellerLabel: "Marc D.",
      },
      "fr"
    )
    expect(line).toMatch(/^Vendu il y a \d+ min par Marc D\.$/)
  })

  it("formats relative minutes", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(formatRelativeMinutesAgo(recent, "en")).toBe("5 min ago")
  })

  it("triggers margin leave-on-table when avg is below 60% of top", () => {
    const hot = {
      activeResellersCount: 5,
      avgMarginCents: 4000,
      topMarginCents: 6700,
      lastSaleAt: null,
      lastSaleResellerLabel: null,
    }
    expect(shouldShowMarginLeaveOnTableTrigger(hot)).toBe(true)
    expect(resolveMarginLeaveOnTableTrigger(hot)).toEqual({
      leftOnTableEur: 27,
      topMarginEur: 67,
    })
  })

  it("skips margin leave-on-table when avg is healthy vs top", () => {
    const ok = {
      activeResellersCount: 5,
      avgMarginCents: 4380,
      topMarginCents: 6700,
      lastSaleAt: null,
      lastSaleResellerLabel: null,
    }
    expect(shouldShowMarginLeaveOnTableTrigger(ok)).toBe(false)
    expect(resolveMarginLeaveOnTableTrigger(ok)).toBeNull()
  })

  it("formats leave-on-table amounts for seed demo SKU", () => {
    const demo = {
      activeResellersCount: 5,
      avgMarginCents: 4380,
      topMarginCents: 6700,
      lastSaleAt: null,
      lastSaleResellerLabel: null,
    }
    expect(Math.round((demo.topMarginCents - demo.avgMarginCents) / 100)).toBe(23)
    expect(Math.round(demo.topMarginCents / 100)).toBe(67)
  })
})
