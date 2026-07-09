import { describe, expect, it, vi } from "vitest"

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orderReturn: {
      findMany: findManyMock,
    },
  },
}))

import {
  CLAWBACK_RISK_WARNING_CENTS,
  loadAffiliateClawbackRisk,
} from "@/lib/affiliate-clawback-risk"

describe("loadAffiliateClawbackRisk", () => {
  it("sums affiliate payout on pending returns in 30d window", async () => {
    findManyMock.mockResolvedValue([
      { order: { affiliatePayoutCents: 3000, commissionCents: 2500 } },
      { order: { affiliatePayoutCents: 0, commissionCents: 1200 } },
    ])

    const result = await loadAffiliateClawbackRisk("aff_1")

    expect(result.riskCents).toBe(4200)
    expect(result.pendingReturnCount).toBe(2)
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["REQUESTED", "AWAITING_SHIPMENT", "IN_TRANSIT", "RECEIVED"] },
          order: { affiliateId: "aff_1" },
        }),
      })
    )
  })

  it("exposes warning threshold at 500€", () => {
    expect(CLAWBACK_RISK_WARNING_CENTS).toBe(50_000)
  })
})
