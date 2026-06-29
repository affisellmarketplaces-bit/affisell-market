import { describe, expect, it } from "vitest"

import { carrierTrackingUrl } from "@/lib/buyer-carrier-tracking"
import { formatBuyerSafeReturnAddress } from "@/lib/buyer-return-address"
import {
  EU_WITHDRAWAL_DAYS,
  euWithdrawalEndsAt,
  isWithinEuWithdrawalWindow,
  withdrawalAnchorAt,
} from "@/lib/buyer-withdrawal-window"

describe("buyer-withdrawal-window", () => {
  it("anchors on delivery date only", () => {
    const delivered = new Date("2026-06-01T12:00:00Z")
    expect(
      withdrawalAnchorAt({
        deliveredAt: delivered,
        deliveryConfirmedAt: null,
      })
    ).toEqual(delivered)
    expect(
      withdrawalAnchorAt({
        deliveredAt: null,
        deliveryConfirmedAt: null,
      })
    ).toBeNull()
  })

  it("ends 14 days after delivery", () => {
    const delivered = new Date("2026-06-01T12:00:00Z")
    const end = euWithdrawalEndsAt({ deliveredAt: delivered, deliveryConfirmedAt: null })
    expect(end).not.toBeNull()
    const diffDays = Math.round((end!.getTime() - delivered.getTime()) / 86_400_000)
    expect(diffDays).toBe(EU_WITHDRAWAL_DAYS)
  })

  it("is within window on day 10, not on day 15", () => {
    const delivered = new Date("2026-06-01T12:00:00Z")
    const order = { deliveredAt: delivered, deliveryConfirmedAt: null }
    expect(isWithinEuWithdrawalWindow(order, new Date("2026-06-11T12:00:00Z"))).toBe(true)
    expect(isWithinEuWithdrawalWindow(order, new Date("2026-06-16T12:00:00Z"))).toBe(false)
  })
})

describe("buyer-return-address", () => {
  it("strips company name from return address", () => {
    const formatted = formatBuyerSafeReturnAddress({
      company: "Secret Supplier GmbH",
      line1: "12 Rue du Commerce",
      city: "Lyon",
      postalCode: "69001",
      countryCode: "FR",
    })
    expect(formatted).not.toContain("Secret Supplier")
    expect(formatted).toContain("12 Rue du Commerce")
    expect(formatted).toContain("69001")
  })
})

describe("carrierTrackingUrl", () => {
  it("builds Colissimo URL", () => {
    expect(carrierTrackingUrl("Colissimo", "AB123")).toContain("laposte.fr")
    expect(carrierTrackingUrl("Colissimo", "AB123")).toContain("AB123")
  })
})
