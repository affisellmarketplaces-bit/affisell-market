import { describe, expect, it } from "vitest"

import { buildExpansionEmailEventsCsv } from "@/lib/admin/build-expansion-email-events-csv"
import {
  formatExpansionEmailEventError,
  parseExpansionEmailEventMeta,
} from "@/lib/expansion/expansion-email-event-meta"
import { shouldAutoPauseLaunchFollowupOnDelivery } from "@/lib/expansion/expansion-auto-pause-notify"
import { isFollowupDeliveryPauseReason } from "@/lib/expansion/expansion-complaint-clear-window"
import { hashExpansionBuyerEmail } from "@/lib/expansion/hash-expansion-buyer-email"

describe("shouldAutoPauseLaunchFollowupOnDelivery", () => {
  it("pauses when follow-up delivery drops below 50%", () => {
    expect(
      shouldAutoPauseLaunchFollowupOnDelivery({
        followupDeliveredThisMonth: 40,
        followupSentCount: 100,
      })
    ).toBe(true)
  })

  it("skips when follow-up delivery is healthy", () => {
    expect(
      shouldAutoPauseLaunchFollowupOnDelivery({
        followupDeliveredThisMonth: 85,
        followupSentCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min sent threshold", () => {
    expect(
      shouldAutoPauseLaunchFollowupOnDelivery({
        followupDeliveredThisMonth: 0,
        followupSentCount: 8,
      })
    ).toBe(false)
  })
})

describe("hashExpansionBuyerEmail", () => {
  it("returns stable 16-char hex hash", () => {
    const hash = hashExpansionBuyerEmail("Buyer@Example.com")
    expect(hash).toHaveLength(16)
    expect(hash).toBe(hashExpansionBuyerEmail("buyer@example.com"))
  })
})

describe("expansion email event meta", () => {
  it("round-trips country, kind, and buyer hash", () => {
    const error = formatExpansionEmailEventError({
      countryIso2: "jp",
      emailKind: "checkout-launch-followup",
      buyerEmailHash: "abc123def4567890",
    })
    expect(parseExpansionEmailEventMeta(error)).toEqual({
      countryIso2: "jp",
      emailKind: "checkout-launch-followup",
      buyerEmailHash: "abc123def4567890",
    })
  })

  it("parses legacy rows without buyer hash", () => {
    expect(parseExpansionEmailEventMeta("jp:checkout-launch")).toEqual({
      countryIso2: "jp",
      emailKind: "checkout-launch",
      buyerEmailHash: null,
    })
  })
})

describe("buildExpansionEmailEventsCsv buyerEmailHash", () => {
  it("includes buyerEmailHash column", () => {
    const csv = buildExpansionEmailEventsCsv([
      {
        eventType: "bounce",
        countryIso2: "jp",
        emailKind: "checkout-launch-followup",
        buyerEmailHash: "abc123def4567890",
        occurredAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFeventType;countryIso2;emailKind;buyerEmailHash;occurredAt")).toBe(
      true
    )
    expect(csv).toContain("abc123def4567890")
  })
})

describe("isFollowupDeliveryPauseReason", () => {
  it("detects follow-up delivery pause reasons", () => {
    expect(isFollowupDeliveryPauseReason("followup_delivery_rate_40pct")).toBe(true)
    expect(isFollowupDeliveryPauseReason("followup_complaint_1")).toBe(false)
  })
})
