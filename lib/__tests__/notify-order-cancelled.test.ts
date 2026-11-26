import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  sendCancelledNotificationEmail: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { order: { updateMany: h.updateMany, findUnique: h.findUnique } } }))
vi.mock("@/lib/emails/send-cancelled-notification", () => ({
  sendCancelledNotificationEmail: h.sendCancelledNotificationEmail,
}))

import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"

const statusWrites = () =>
  h.updateMany.mock.calls.filter(([args]) => (args as { data: Record<string, unknown> }).data.status !== undefined)

beforeEach(() => {
  vi.clearAllMocks()
  h.updateMany.mockResolvedValue({ count: 1 })
  h.findUnique.mockResolvedValue({
    id: "o1",
    customerEmail: "b@example.test",
    quantity: 1,
    sellingPriceCents: 1000,
    variantImageUrl: null,
    shippingAddress: null,
    buyerLocale: "fr",
    product: { name: "P", images: [] },
  })
  h.sendCancelledNotificationEmail.mockResolvedValue({ ok: true })
})

describe("notifyOrderCancelled — `refunded` only with a Stripe refund id (D5)", () => {
  it("sends the e-mail but NEVER writes `status` when no refund id is given", async () => {
    const result = await notifyOrderCancelled("o1", { cancelReason: "Annulation" })
    expect(result.sent).toBe(true)
    expect(statusWrites()).toHaveLength(0)
    expect(h.updateMany.mock.calls[0][0].data).toEqual({ cancelledEmailSentAt: expect.any(Date) })
  })

  it("does not treat a blank refund id as a refund", async () => {
    await notifyOrderCancelled("o1", { stripeRefundId: "   " })
    expect(statusWrites()).toHaveLength(0)
  })

  it("writes `status: refunded` when Stripe's refund id is given", async () => {
    await notifyOrderCancelled("o1", { stripeRefundId: "re_123" })
    expect(statusWrites()).toHaveLength(1)
    expect(statusWrites()[0][0]).toMatchObject({ where: { id: "o1" }, data: { status: "refunded" } })
  })

  it("records the refund even when the e-mail was already claimed by an earlier attempt", async () => {
    h.updateMany.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      count: args.data.status !== undefined ? 1 : 0,
    }))
    const result = await notifyOrderCancelled("o1", { stripeRefundId: "re_123" })
    expect(statusWrites()).toHaveLength(1)
    expect(result).toEqual({ sent: false })
    expect(h.sendCancelledNotificationEmail).not.toHaveBeenCalled()
  })
})
