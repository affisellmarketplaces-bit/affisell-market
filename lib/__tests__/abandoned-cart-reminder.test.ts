import { describe, expect, it, vi, beforeEach } from "vitest"

describe("runAbandonedCartReminderCron", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("sends recovery email and marks cartAbandonmentEmailSentAt", async () => {
    const staleAt = new Date("2026-07-01T10:00:00Z")
    const update = vi.fn().mockResolvedValue({})
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "cart_1",
        updatedAt: staleAt,
        user: { id: "user_1", email: "buyer@example.com", name: "Marie" },
        items: [
          {
            affiliateProductId: "ap_1",
            quantity: 1,
            affiliateProduct: {
              id: "ap_1",
              sellingPriceCents: 2990,
              isListed: true,
              product: { name: "Serum Vit C", images: [] },
            },
          },
        ],
      },
    ])

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        cart: { findMany, update },
        order: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    }))
    vi.doMock("@/lib/emails/send-abandoned-cart-reminder", () => ({
      sendAbandonedCartReminderEmail: vi.fn().mockResolvedValue({ ok: true }),
    }))
    vi.doMock("@/lib/emails/send-order-confirmation", () => ({
      resolveAppUrl: () => "https://affisell.com",
    }))

    const { runAbandonedCartReminderCron } = await import("@/lib/cron/abandoned-cart-reminder")
    const result = await runAbandonedCartReminderCron({ hoursAfterInactivity: 1, limit: 10 })

    expect(result.sent).toBe(1)
    expect(result.skippedAlreadyPurchased).toBe(0)
    expect(update).toHaveBeenCalledWith({
      where: { id: "cart_1" },
      data: { cartAbandonmentEmailSentAt: expect.any(Date) },
    })
  })

  it("skips send when buyer already purchased since cart activity", async () => {
    const staleAt = new Date("2026-07-01T10:00:00Z")
    const update = vi.fn().mockResolvedValue({})
    const send = vi.fn()

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        cart: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "cart_2",
              updatedAt: staleAt,
              user: { id: "user_2", email: "buyer@example.com", name: null },
              items: [
                {
                  affiliateProductId: "ap_1",
                  quantity: 2,
                  affiliateProduct: {
                    id: "ap_1",
                    sellingPriceCents: 1500,
                    isListed: true,
                    product: { name: "Serum", images: [] },
                  },
                },
              ],
            },
          ]),
          update,
        },
        order: { findFirst: vi.fn().mockResolvedValue({ id: "ord_new" }) },
      },
    }))
    vi.doMock("@/lib/emails/send-abandoned-cart-reminder", () => ({
      sendAbandonedCartReminderEmail: send,
    }))
    vi.doMock("@/lib/emails/send-order-confirmation", () => ({
      resolveAppUrl: () => "https://affisell.com",
    }))

    const { runAbandonedCartReminderCron } = await import("@/lib/cron/abandoned-cart-reminder")
    const result = await runAbandonedCartReminderCron()

    expect(result.sent).toBe(0)
    expect(result.skippedAlreadyPurchased).toBe(1)
    expect(send).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      where: { id: "cart_2" },
      data: { cartAbandonmentEmailSentAt: expect.any(Date) },
    })
  })
})
