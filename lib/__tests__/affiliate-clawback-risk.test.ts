import { describe, expect, it, vi } from "vitest"

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: findManyMock,
    },
  },
}))

import {
  CLAWBACK_RISK_WARNING_CENTS,
  loadAffiliateClawbackRisk,
} from "@/lib/affiliate-clawback-risk"

describe("loadAffiliateClawbackRisk", () => {
  it("sums affiliate commission on orders with pending returns in 30d window", async () => {
    findManyMock.mockResolvedValue([
      { affiliatePayoutCents: 3000, commissionCents: 2500 },
      { affiliatePayoutCents: 0, commissionCents: 1200 },
    ])

    const result = await loadAffiliateClawbackRisk("aff_1")

    expect(result.riskCents).toBe(4200)
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          affiliateId: "aff_1",
          returns: expect.objectContaining({
            some: expect.objectContaining({
              status: { in: ["REQUESTED", "AWAITING_SHIPMENT", "IN_TRANSIT", "RECEIVED"] },
            }),
          }),
        }),
      })
    )
  })

  it("returns zero when no orders are at risk", async () => {
    findManyMock.mockResolvedValue([])

    const result = await loadAffiliateClawbackRisk("aff_2")

    expect(result.riskCents).toBe(0)
  })

  it("exposes warning threshold at 500€", () => {
    expect(CLAWBACK_RISK_WARNING_CENTS).toBe(50_000)
  })
})
