import { describe, expect, it } from "vitest"

import { runExpansionFollowupBounceRateAlert } from "@/lib/cron/expansion-followup-bounce-rate-alert"
import { shouldAlertGraduatedBounceRate } from "@/lib/expansion/compute-country-bounce-rate"
import {
  followupDeliveryDigestBadge,
  shouldShowFollowupLowDeliveryDigestRow,
} from "@/lib/expansion/expansion-digest-followup-delivery-badge"

describe("followupDeliveryDigestBadge", () => {
  it("flags auto-pause zone below 50%", () => {
    expect(followupDeliveryDigestBadge(45)).toBe(" · 🔴 auto-pause zone")
  })

  it("flags low delivery below 80%", () => {
    expect(followupDeliveryDigestBadge(70)).toBe(" · ⚠ low delivery")
  })

  it("skips healthy delivery rates", () => {
    expect(followupDeliveryDigestBadge(90)).toBe("")
  })
})

describe("shouldShowFollowupLowDeliveryDigestRow", () => {
  it("includes countries with min sent and low delivery", () => {
    expect(
      shouldShowFollowupLowDeliveryDigestRow({
        followUpCount: 12,
        launchFollowupDeliveryRatePct: 65,
      })
    ).toBe(true)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldShowFollowupLowDeliveryDigestRow({
        followUpCount: 8,
        launchFollowupDeliveryRatePct: 40,
      })
    ).toBe(false)
  })
})

describe("shouldAlertGraduatedBounceRate for J+2 follow-up", () => {
  it("alerts when follow-up bounce rate exceeds 5%", () => {
    expect(
      shouldAlertGraduatedBounceRate({
        bouncesThisMonth: 2,
        sentCount: 20,
      })
    ).toBe(true)
  })
})

describe("runExpansionFollowupBounceRateAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionFollowupBounceRateAlert).toBe("function")
  })
})
