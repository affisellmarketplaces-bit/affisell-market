import { describe, expect, it } from "vitest"

import {
  formatStuckStripeHealthSlackMessage,
  type StuckStripeOrder,
} from "@/lib/cron/stripe-health"

describe("formatStuckStripeHealthSlackMessage", () => {
  it("includes order id and webhook status", () => {
    const orders: StuckStripeOrder[] = [
      {
        orderId: "order_abc123",
        orderNumber: "ORDER_AB",
        customerEmail: "a@b.com",
        totalCents: 14_560,
        createdAt: new Date("2026-05-19T10:00:00Z"),
        paymentSettlementStatus: "PAID",
        webhookStatus: "failed",
        webhookError: "affiliate:AFFILIATE_ONBOARDING_REQUIRED:acct_fail",
      },
    ]
    const msg = formatStuckStripeHealthSlackMessage(orders)
    expect(msg).toContain("Stripe health")
    expect(msg).toContain("ORDER_AB")
    expect(msg).toContain("order_abc123")
    expect(msg).toContain("failed")
    expect(msg).toContain("acct_fail")
  })
})
