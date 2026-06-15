import { describe, expect, it } from "vitest"

import {
  expansionLaunchResendTags,
  readExpansionCountryFromResendTags,
} from "@/lib/expansion/expansion-email-tags"
import {
  isSuppressedWaitlistStale,
  suppressedWaitlistPurgeCutoff,
} from "@/lib/expansion/suppressed-waitlist-purge"
import { computeLaunchDeliveryRatePct } from "@/lib/resend-webhook/expansion-email-delivered"

describe("expansion email tags sprint 23", () => {
  it("includes expansion-country tag on launch emails", () => {
    expect(expansionLaunchResendTags("JP")).toEqual([
      { name: "expansion", value: "checkout-launch" },
      { name: "expansion-country", value: "jp" },
    ])
  })

  it("reads country from resend tags", () => {
    expect(
      readExpansionCountryFromResendTags([
        { name: "expansion", value: "checkout-launch" },
        { name: "expansion-country", value: "br" },
      ])
    ).toBe("br")
  })
})

describe("suppressed waitlist purge", () => {
  it("marks rows older than 90 days as stale", () => {
    const now = new Date("2026-06-10T12:00:00.000Z")
    const suppressedAt = new Date("2026-02-01T12:00:00.000Z")
    expect(isSuppressedWaitlistStale(suppressedAt, now)).toBe(true)
    expect(suppressedAt.getTime()).toBeLessThan(suppressedWaitlistPurgeCutoff(now).getTime())
  })
})

describe("computeLaunchDeliveryRatePct", () => {
  it("caps delivery rate at 100%", () => {
    expect(
      computeLaunchDeliveryRatePct({
        deliveredThisMonth: 120,
        notifiedCount: 100,
      })
    ).toBe(100)
  })
})
