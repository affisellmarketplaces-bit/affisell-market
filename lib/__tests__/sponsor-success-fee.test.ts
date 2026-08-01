import { describe, expect, it } from "vitest"

import {
  quoteSponsorCampaign,
  successFeeCentsForSale,
} from "@/lib/sponsor/sponsor-pricing"

describe("sponsor success-fee pricing", () => {
  it("quotes per-sale fee without weeks multiplier", () => {
    const q = quoteSponsorCampaign({
      htCents: 10_000,
      sponsorRateBps: 500,
      durationDays: 7,
      placement: "SEARCH_BOOST",
      billingMode: "SUCCESS_FEE",
    })
    // 10000 * 500 * 1 / 10000 = 500¢
    expect(q.feeCents).toBe(500)
    expect(q.feePerSaleCents).toBe(500)
    expect(q.billingMode).toBe("SUCCESS_FEE")
  })

  it("keeps upfront weeks multiplier for legacy mode", () => {
    const q = quoteSponsorCampaign({
      htCents: 10_000,
      sponsorRateBps: 500,
      durationDays: 14,
      placement: "SEARCH_BOOST",
      billingMode: "UPFRONT",
    })
    // 10000 * 500 * 1 * 2 / 10000 = 1000¢
    expect(q.feeCents).toBe(1000)
  })

  it("applies placement multiplier on success fee", () => {
    expect(
      successFeeCentsForSale({
        htCents: 10_000,
        sponsorRateBps: 500,
        placement: "HOME_SPOTLIGHT",
      })
    ).toBe(750) // ×1.5
  })
})
