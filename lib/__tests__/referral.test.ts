import { describe, expect, it } from "vitest"

import {
  buildPayoutTweetText,
  FILLEUL_WELCOME_BONUS_BPS,
  FILLEUL_WELCOME_DAYS,
  REFERRER_BONUS_BPS,
  referralShareUrl,
  UGC_BOUNTY_CENTS,
} from "@/lib/referral-shared"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"

describe("referral-shared", () => {
  it("builds share URL", () => {
    expect(referralShareUrl("abc123", "https://affisell.com")).toBe(
      "https://affisell.com/r/abc123"
    )
  })

  it("builds FR tweet with hashtag", () => {
    const text = buildPayoutTweetText({
      earningsLabel: "42,00 €",
      referralUrl: "https://affisell.com/r/abc",
      locale: "fr",
    })
    expect(text).toContain("#Affisell300")
    expect(text).toContain("42,00 €")
  })
})

describe("referral bonus math", () => {
  it("computes 10% referrer and 5% filleul from net affiliate transfer", () => {
    const net = netAffiliateTransferCents({
      affiliatePayoutCents: 900,
      affiliateMarginRetainedCents: 500,
      affiliateFeeCents: 280,
      affiliateMarginCents: 0,
    })
    expect(net).toBe(1400)
    expect(Math.floor((net * REFERRER_BONUS_BPS) / 10_000)).toBe(140)
    expect(Math.floor((net * FILLEUL_WELCOME_BONUS_BPS) / 10_000)).toBe(70)
  })

  it("exposes UGC bounty constant", () => {
    expect(UGC_BOUNTY_CENTS).toBe(5000)
    expect(FILLEUL_WELCOME_DAYS).toBe(30)
  })
})
