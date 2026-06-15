import { describe, expect, it } from "vitest"

import { buildSuppressedWaitlistCsv } from "@/lib/admin/build-suppressed-waitlist-csv"
import { hashExpansionBuyerEmail } from "@/lib/expansion/hash-expansion-buyer-email"
import {
  computeCountryBounceRatePct,
  shouldAlertCountryBounceRate,
} from "@/lib/expansion/compute-country-bounce-rate"

describe("computeCountryBounceRatePct", () => {
  it("returns 0 when no notified base", () => {
    expect(computeCountryBounceRatePct({ notifiedCount: 0, retriesPending: 0, suppressed: 0 })).toBe(0)
  })

  it("computes bounce rate from notified and bounce rows", () => {
    expect(
      computeCountryBounceRatePct({
        notifiedCount: 18,
        retriesPending: 1,
        suppressed: 1,
      })
    ).toBe(10.5)
  })
})

describe("shouldAlertCountryBounceRate", () => {
  it("alerts above 5% with enough notified volume", () => {
    expect(
      shouldAlertCountryBounceRate({
        notifiedCount: 90,
        retriesPending: 5,
        suppressed: 6,
      })
    ).toBe(true)
  })

  it("skips low sample size", () => {
    expect(
      shouldAlertCountryBounceRate({
        notifiedCount: 5,
        retriesPending: 1,
        suppressed: 1,
      })
    ).toBe(false)
  })
})

describe("buildSuppressedWaitlistCsv", () => {
  it("exports UTF-8 BOM CSV with headers", () => {
    const csv = buildSuppressedWaitlistCsv([
      {
        email: "buyer@example.com",
        countryIso2: "jp",
        locale: "en",
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        launchEmailBouncedAt: new Date("2026-06-02T10:00:00.000Z"),
        launchEmailSuppressedAt: new Date("2026-06-03T10:00:00.000Z"),
        launchNotifiedAt: new Date("2026-06-01T12:00:00.000Z"),
      },
    ])
    const hash = hashExpansionBuyerEmail("buyer@example.com")
    expect(csv.startsWith("\uFEFFemailKind;buyerEmailHash;countryIso2")).toBe(true)
    expect(csv).toContain("checkout-launch")
    expect(csv).toContain(hash)
    expect(csv).not.toContain("buyer@example.com")
    expect(csv).toContain("jp")
  })
})
