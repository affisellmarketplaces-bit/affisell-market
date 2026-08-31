import { describe, expect, it } from "vitest"

import { AFFILIATE_PAYOUT_SETTINGS_HREF } from "@/lib/affiliate-onboarding-shared"
import { stripeConnectReturnUrls } from "@/lib/stripe-connect-legal"

describe("affiliate payout settings", () => {
  it("exposes dedicated payout settings href", () => {
    expect(AFFILIATE_PAYOUT_SETTINGS_HREF).toBe("/dashboard/affiliate/settings/payouts")
  })

  it("routes Stripe Connect return to payout settings for affiliates", () => {
    const urls = stripeConnectReturnUrls("AFFILIATE")
    expect(urls.return_url).toContain("/dashboard/affiliate/settings/payouts?stripe=return")
    expect(urls.refresh_url).toContain("/dashboard/affiliate/settings/payouts?stripe=refresh")
  })
})
