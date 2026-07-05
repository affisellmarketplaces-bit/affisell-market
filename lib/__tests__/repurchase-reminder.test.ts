import { describe, expect, it, vi, beforeEach } from "vitest"

describe("runRepurchaseReminderCron", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("sends repurchase email and marks repurchaseReminderSentAt", async () => {
    const deliveredAt = new Date("2026-05-01T12:00:00Z")
    const update = vi.fn().mockResolvedValue({})
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "ord_1",
        customerEmail: "buyer@example.com",
        deliveredAt,
        variantImageUrl: null,
        shippingAddress: null,
        buyerLocale: "fr",
        buyer: { email: "buyer@example.com", name: "Marie" },
        product: { name: "Serum Vit C", images: [] },
        affiliateProduct: { id: "ap_1", isListed: true },
      },
    ])

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findMany,
          findFirst: vi.fn().mockResolvedValue(null),
          update,
        },
      },
    }))
    vi.doMock("@/lib/emails/send-repurchase-reminder", () => ({
      sendRepurchaseReminderEmail: vi.fn().mockResolvedValue({ ok: true }),
    }))

    const { runRepurchaseReminderCron } = await import("@/lib/cron/repurchase-reminder")
    const result = await runRepurchaseReminderCron({ daysAfterDelivery: 30, limit: 10 })

    expect(result.sent).toBe(1)
    expect(result.skippedAlreadyRepurchased).toBe(0)
    expect(update).toHaveBeenCalledWith({
      where: { id: "ord_1" },
      data: { repurchaseReminderSentAt: expect.any(Date) },
    })
  })

  it("skips send when buyer already repurchased same listing", async () => {
    const deliveredAt = new Date("2026-05-01T12:00:00Z")
    const update = vi.fn().mockResolvedValue({})
    const send = vi.fn()

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "ord_old",
              customerEmail: "buyer@example.com",
              deliveredAt,
              variantImageUrl: null,
              shippingAddress: null,
              buyerLocale: "en",
              buyer: null,
              product: { name: "Serum", images: [] },
              affiliateProduct: { id: "ap_1", isListed: true },
            },
          ]),
          findFirst: vi.fn().mockResolvedValue({ id: "ord_new" }),
          update,
        },
      },
    }))
    vi.doMock("@/lib/emails/send-repurchase-reminder", () => ({
      sendRepurchaseReminderEmail: send,
    }))

    const { runRepurchaseReminderCron } = await import("@/lib/cron/repurchase-reminder")
    const result = await runRepurchaseReminderCron()

    expect(result.sent).toBe(0)
    expect(result.skippedAlreadyRepurchased).toBe(1)
    expect(send).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      where: { id: "ord_old" },
      data: { repurchaseReminderSentAt: expect.any(Date) },
    })
  })
})
