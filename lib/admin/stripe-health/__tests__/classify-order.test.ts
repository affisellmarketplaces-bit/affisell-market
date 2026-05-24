import { describe, expect, it } from "vitest"

import {
  classifyStripeHealthOrder,
  isOrderSplitSettled,
} from "@/lib/admin/stripe-health/classify-order"
import { parseWebhookErrorMessage } from "@/lib/admin/stripe-health/parse-webhook-error"

describe("classifyStripeHealthOrder", () => {
  const base = {
    status: "paid",
    paymentSettlementStatus: "PAID",
    supplierPayoutCents: 0,
    affiliatePayoutCents: 0,
    supplierOnboarded: true,
    affiliateOnboarded: true,
    affiliateStripeAccountId: "acct_aff",
  }

  it("returns split_ok when SETTLED", () => {
    expect(
      classifyStripeHealthOrder(
        { ...base, paymentSettlementStatus: "SETTLED" },
        null
      )
    ).toBe("split_ok")
  })

  it("returns split_ok when both payouts recorded", () => {
    expect(
      classifyStripeHealthOrder(
        { ...base, supplierPayoutCents: 100, affiliatePayoutCents: 50 },
        null
      )
    ).toBe("split_ok")
  })

  it("returns onboarding_required on failed webhook with onboarding error", () => {
    expect(
      classifyStripeHealthOrder(base, {
        status: "failed",
        error: "affiliate:AFFILIATE_ONBOARDING_REQUIRED:acct_xyz",
      })
    ).toBe("onboarding_required")
  })

  it("returns split_failed on other webhook failures", () => {
    expect(
      classifyStripeHealthOrder(base, {
        status: "failed",
        error: "supplier:charge_already_transferred",
      })
    ).toBe("split_failed")
  })

  it("returns onboarding_required when affiliate not onboarded", () => {
    expect(
      classifyStripeHealthOrder({ ...base, affiliateOnboarded: false }, null)
    ).toBe("onboarding_required")
  })

  it("returns paid when paid and onboarded but not settled", () => {
    expect(classifyStripeHealthOrder(base, null)).toBe("paid")
  })
})

describe("isOrderSplitSettled", () => {
  it("detects payout cents", () => {
    expect(
      isOrderSplitSettled({
        status: "paid",
        paymentSettlementStatus: "PAID",
        supplierPayoutCents: 1,
        affiliatePayoutCents: 1,
        supplierOnboarded: true,
        affiliateOnboarded: true,
        affiliateStripeAccountId: null,
      })
    ).toBe(true)
  })
})

describe("parseWebhookErrorMessage", () => {
  it("parses AFFILIATE_ONBOARDING_REQUIRED", () => {
    const p = parseWebhookErrorMessage(
      "affiliate:AFFILIATE_ONBOARDING_REQUIRED:acct_1Test123"
    )
    expect(p.errorCode).toBe("affiliate_onboarding_required")
    expect(p.accountId).toBe("acct_1Test123")
    expect(p.stripeDashboardUrl).toContain("acct_1Test123")
  })

  it("parses insufficient_capabilities", () => {
    const p = parseWebhookErrorMessage(
      "affiliate:insufficient_capabilities_for_transfer for acct_abc"
    )
    expect(p.errorCode).toBe("insufficient_capabilities_for_transfer")
    expect(p.accountId).toBe("acct_abc")
  })
})
