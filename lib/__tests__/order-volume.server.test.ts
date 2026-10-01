import { describe, expect, it, vi, beforeEach } from "vitest"

const { countOrder } = vi.hoisted(() => ({ countOrder: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: { order: { count: countOrder } },
}))

import { loadMonthlyAffiliateOrderCount } from "@/lib/growth/order-volume.server"

describe("loadMonthlyAffiliateOrderCount", () => {
  beforeEach(() => {
    countOrder.mockReset()
  })

  it("counts orders scoped to this affiliate from the start of the current month", async () => {
    countOrder.mockResolvedValue(42)
    const count = await loadMonthlyAffiliateOrderCount("affiliate-1")
    expect(count).toBe(42)
    expect(countOrder).toHaveBeenCalledWith({
      where: {
        affiliateId: "affiliate-1",
        createdAt: { gte: expect.any(Date) },
      },
    })
    const callArg = countOrder.mock.calls[0][0]
    const gte: Date = callArg.where.createdAt.gte
    const now = new Date()
    expect(gte.getFullYear()).toBe(now.getFullYear())
    expect(gte.getMonth()).toBe(now.getMonth())
    expect(gte.getDate()).toBe(1)
  })
})
