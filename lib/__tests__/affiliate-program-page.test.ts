import { describe, expect, it } from "vitest"

import {
  AFFILIATE_CATALOG_VERTICALS,
  AFFILIATE_COMMISSION_MAX_PCT,
  AFFILIATE_COMMISSION_MIN_PCT,
  AFFILIATE_PAYOUT_MIN_CENTS,
  AFFILIATE_TAX_RESIDENCE_ROWS,
  affiliateProgramFinanceFacts,
} from "@/lib/affiliate-program-finance"

describe("affiliate-program-finance", () => {
  it("exposes 10–30% HT commission range", () => {
    expect(AFFILIATE_COMMISSION_MIN_PCT).toBe(10)
    expect(AFFILIATE_COMMISSION_MAX_PCT).toBe(30)
  })

  it("uses 50 EUR payout threshold", () => {
    expect(AFFILIATE_PAYOUT_MIN_CENTS).toBe(5000)
    expect(affiliateProgramFinanceFacts.cookieDays).toBe(30)
  })

  it("lists tax rows including FR and BJ", () => {
    const codes = AFFILIATE_TAX_RESIDENCE_ROWS.map((r) => r.code)
    expect(codes).toContain("FR")
    expect(codes).toContain("BJ")
    const fr = AFFILIATE_TAX_RESIDENCE_ROWS.find((r) => r.code === "FR")
    expect(fr?.regimeFr).toMatch(/36.?000/)
    const bj = AFFILIATE_TAX_RESIDENCE_ROWS.find((r) => r.code === "BJ")
    expect(bj?.regimeFr).toMatch(/ISB/)
  })

  it("catalog verticals hide supplier identity", () => {
    const labels = AFFILIATE_CATALOG_VERTICALS.map((v) => v.labelFr)
    expect(labels).toContain("Mode")
    expect(labels).toContain("Beauté")
    for (const v of AFFILIATE_CATALOG_VERTICALS) {
      expect(v.labelFr.toLowerCase()).not.toMatch(/fournisseur|supplier/)
    }
  })
})
