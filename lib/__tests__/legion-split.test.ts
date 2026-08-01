import { describe, expect, it, vi } from "vitest"

import {
  calculateLegionSplit,
  canInstantPayout,
  canShowLegionPayout24hBadge,
  getPayoutDueAt,
  LEGION_OVERRIDE_RATE,
  LEGION_PAYOUT_24H_MIN_SALES,
  PAYOUT_DELAY,
  PLATFORM_FEE,
  RESERVE_RATE,
} from "@/lib/legion/split"

describe("legion split constants", () => {
  it("keeps LÉGION economics", () => {
    expect(LEGION_OVERRIDE_RATE).toBe(0.02)
    expect(PLATFORM_FEE).toBe(0.1)
    expect(RESERVE_RATE).toBe(0.2)
    expect(PAYOUT_DELAY).toBe(24)
  })
})

describe("calculateLegionSplit", () => {
  it("applies 2% override from filleul margin when referral active", async () => {
    const supabase = {
      legionReferral: {
        findFirst: vi.fn().mockResolvedValue({
          sponsorId: "sponsor_1",
          overrideRate: 0.02,
          status: "active",
        }),
      },
    }

    const split = await calculateLegionSplit({
      supabase,
      product_price: 100,
      seller_margin_rate: 0.3,
      store_profile_id: "filleul_1",
    })

    expect(split.base_seller_earnings).toBe(30)
    expect(split.legion_override).toBe(2)
    expect(split.seller_earnings).toBe(28)
    expect(split.remaining_after_seller).toBe(70)
    expect(split.platform_fee).toBe(10)
    expect(split.supplier_gross).toBe(60)
    expect(split.reserve).toBe(12)
    expect(split.supplier).toBe(48)
    expect(split.sponsor_id).toBe("sponsor_1")
  })

  it("skips override when no referral", async () => {
    const supabase = {
      legionReferral: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }

    const split = await calculateLegionSplit({
      supabase,
      product_price: 100,
      seller_margin_rate: 0.3,
      store_profile_id: "orphan_1",
    })

    expect(split.legion_override).toBe(0)
    expect(split.seller_earnings).toBe(30)
    expect(split.sponsor_id).toBeNull()
  })
})

describe("payout helpers", () => {
  it("getPayoutDueAt is +24h ISO", () => {
    const from = new Date("2026-08-01T12:00:00.000Z")
    expect(getPayoutDueAt(from)).toBe("2026-08-02T12:00:00.000Z")
  })

  it("canInstantPayout requires balance coverage", () => {
    expect(canInstantPayout(50, 40)).toBe(true)
    expect(canInstantPayout(30, 40)).toBe(false)
    expect(canInstantPayout(100, 0)).toBe(false)
  })

  it("Paiement 24h badge requires notoriété via sales", () => {
    expect(LEGION_PAYOUT_24H_MIN_SALES).toBe(100)
    expect(canShowLegionPayout24hBadge(0)).toBe(false)
    expect(canShowLegionPayout24hBadge(99)).toBe(false)
    expect(canShowLegionPayout24hBadge(100)).toBe(true)
    expect(canShowLegionPayout24hBadge(142)).toBe(true)
  })
})
