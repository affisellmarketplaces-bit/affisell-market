import { describe, expect, it } from "vitest"

import { buildSuccessReviewHref } from "@/lib/success-review-href"

describe("buildSuccessReviewHref", () => {
  it("builds marketplace review URL with orderId", () => {
    expect(buildSuccessReviewHref("ap_123", "ord_456")).toBe(
      "/marketplace/ap_123?writeReview=true&orderId=ord_456"
    )
  })
})
