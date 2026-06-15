import { describe, expect, it } from "vitest"

import {
  isExpansionBuyerResendEmail,
  processExpansionResendDeliveryEvent,
} from "@/lib/resend-webhook/expansion-email-delivery"

describe("isExpansionBuyerResendEmail", () => {
  it("matches expansion resend tags", () => {
    expect(
      isExpansionBuyerResendEmail({
        tags: [{ name: "expansion", value: "checkout-launch" }],
        subject: "Hello",
      })
    ).toBe(true)
  })

  it("matches launch subject fallback", () => {
    expect(
      isExpansionBuyerResendEmail({
        subject: "Checkout is live in Japan — shop on Affisell",
      })
    ).toBe(true)
  })

  it("ignores unrelated transactional mail", () => {
    expect(
      isExpansionBuyerResendEmail({
        subject: "Your Affisell order confirmation",
      })
    ).toBe(false)
  })
})

describe("processExpansionResendDeliveryEvent", () => {
  it("ignores non-expansion events", async () => {
    const result = await processExpansionResendDeliveryEvent(
      {
        type: "email.delivered",
        data: { subject: "Checkout is live in Japan" },
      },
      "msg_test"
    )
    expect(result).toEqual({ handled: false, alerted: false, retryQueued: 0, suppressed: 0, complaintSuppressed: 0, webhookStatus: null })
  })
})
