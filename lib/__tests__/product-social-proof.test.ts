import { describe, expect, it } from "vitest"

import { anonymizeDisplayName } from "@/lib/anonymize-display-name"
import {
  formatLastSaleAgoLine,
  formatMarginLeaveEurFromCents,
  formatMarginTopEurFromCents,
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

  it("formats last sale line in FR with reseller", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString()
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
    expect(line).toBe("Vendu il y a 5 min par Marc D.")
  })

  it("formats relative minutes", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(formatRelativeMinutesAgo(recent, "en")).toBe("5 min ago")
  })

  it("triggers margin leave-on-table when avg is below 80% of top", () => {
    const seedDemo = {
      activeResellersCount: 5,
      avgMarginCents: 4380,
      topMarginCents: 6700,
      lastSaleAt: null,
      lastSaleResellerLabel: null,
    }
    expect(shouldShowMarginLeaveOnTableTrigger(seedDemo)).toBe(true)
    expect(resolveMarginLeaveOnTableTrigger(seedDemo)).toEqual({
      leftOnTableCents: 2320,
      topMarginCents: 6700,
    })
    expect(formatMarginLeaveEurFromCents(2320, "fr")).toBe("23,20€")
    expect(formatMarginTopEurFromCents(6700, "fr")).toBe("67€")
  })

  it("skips margin leave-on-table when avg is close to top", () => {
    const ok = {
      activeResellersCount: 5,
      avgMarginCents: 5500,
      topMarginCents: 6700,
      lastSaleAt: null,
      lastSaleResellerLabel: null,
    }
    expect(shouldShowMarginLeaveOnTableTrigger(ok)).toBe(false)
    expect(resolveMarginLeaveOnTableTrigger(ok)).toBeNull()
  })
})
