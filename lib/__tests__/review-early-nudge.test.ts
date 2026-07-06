import { describe, expect, it, vi, beforeEach } from "vitest"

describe("runReviewEarlyNudgeCron", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("sends review push and marks reviewEarlyNudgeSentAt", async () => {
    const deliveredAt = new Date("2026-06-01T12:00:00Z")
    const update = vi.fn().mockResolvedValue({})
    const notify = vi.fn().mockResolvedValue(1)

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "ord_1",
              buyerUserId: "user_1",
              customerEmail: "buyer@example.com",
              deliveredAt,
              product: { name: "Serum Vit C" },
              affiliateProduct: { id: "ap_1" },
            },
          ]),
          update,
        },
      },
    }))
    vi.doMock("@/lib/order-review-push", () => ({
      notifyOrderReviewNudgePush: notify,
    }))

    const { runReviewEarlyNudgeCron } = await import("@/lib/cron/review-early-nudge")
    const result = await runReviewEarlyNudgeCron({ daysAfterDelivery: 3, limit: 10 })

    expect(result.sent).toBe(1)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_1",
        affiliateProductId: "ap_1",
      })
    )
    expect(update).toHaveBeenCalledWith({
      where: { id: "ord_1" },
      data: { reviewEarlyNudgeSentAt: expect.any(Date) },
    })
  })

  it("marks nudge sent even when push skipped (no subscriber)", async () => {
    const deliveredAt = new Date("2026-06-01T12:00:00Z")
    const update = vi.fn().mockResolvedValue({})

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "ord_2",
              buyerUserId: null,
              customerEmail: "guest@example.com",
              deliveredAt,
              product: { name: "Cream" },
              affiliateProduct: { id: "ap_2" },
            },
          ]),
          update,
        },
      },
    }))
    vi.doMock("@/lib/order-review-push", () => ({
      notifyOrderReviewNudgePush: vi.fn().mockResolvedValue(0),
    }))

    const { runReviewEarlyNudgeCron } = await import("@/lib/cron/review-early-nudge")
    const result = await runReviewEarlyNudgeCron()

    expect(result.sent).toBe(0)
    expect(result.skipped).toBe(1)
    expect(update).toHaveBeenCalled()
  })
})
