import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * D5 — a buyer's booking cancellation whose Stripe refund FAILS must not end up "cancelled, never refunded": the retry
 * re-attempts the refund (it used to answer "ok" because the booking was already cancelled).
 */
const m = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  releaseSeats: vi.fn(async () => undefined),
  refund: vi.fn(),
  alerts: [] as string[],
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(async () => (m.order ? { ...m.order } : null)),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: {
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(m.order!, data)
          }),
        },
      })
    ),
  },
}))
vi.mock("@/lib/booking/slot-hold", () => ({
  releaseConfirmedBookingSeatsInTransaction: m.releaseSeats,
  releaseBookingSlotHoldForOrder: vi.fn(),
}))
vi.mock("@/lib/booking/cancellation-policy", () => ({ canBuyerCancelBooking: () => ({ allowed: true }) }))
vi.mock("@/lib/marketplace-refund-pipeline", () => ({ initiateMarketplaceRefundPipeline: m.refund }))
vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: vi.fn(async (t: string) => {
    m.alerts.push(t)
    return { slack: false, discord: false }
  }),
}))
vi.mock("@/lib/booking/waitlist", () => ({ processBookingWaitlistNotifications: vi.fn(async () => undefined) }))
vi.mock("@/lib/emails/send-booking-cancellation", () => ({ sendBookingCancellationEmail: vi.fn(async () => undefined) }))

import { cancelBookingOrderForBuyer } from "@/lib/booking/cancel-order"

const ARGS = { orderId: "o1", buyerUserId: "u1", buyerEmail: "jo@example.com" }

beforeEach(() => {
  m.order = {
    id: "o1",
    status: "paid",
    paymentSettlementStatus: "PAID",
    quantity: 1,
    customerEmail: "jo@example.com",
    buyerUserId: "u1",
    buyerLocale: "fr",
    bookingSlotId: "slot1",
    bookingSnapshot: {},
    bookingConfirmedAt: new Date(),
    bookingCancelledAt: null,
    bookingToken: null,
    listingKindSnapshot: "SERVICE",
    product: { name: "Atelier" },
  }
  m.releaseSeats.mockClear()
  m.refund.mockReset()
  m.alerts = []
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

describe("cancelBookingOrderForBuyer", () => {
  it("cancels and refunds", async () => {
    m.refund.mockResolvedValue({ ok: true, stripeRefundId: "re_1" })

    await expect(cancelBookingOrderForBuyer(ARGS)).resolves.toEqual({ ok: true, stripeRefundId: "re_1", refundPending: true })
    expect(m.releaseSeats).toHaveBeenCalledTimes(1)
    expect(m.order!.status).toBe("cancelled")
  })

  it("after a FAILED refund, the retry re-attempts the refund (and does not release the seats twice)", async () => {
    m.refund.mockResolvedValueOnce({ ok: false, error: "stripe_unavailable" })

    await expect(cancelBookingOrderForBuyer(ARGS)).resolves.toMatchObject({ ok: false, status: 502 })
    expect(m.alerts).toHaveLength(1)
    expect(m.order!.bookingCancelledAt).toBeInstanceOf(Date)

    m.refund.mockResolvedValueOnce({ ok: true, stripeRefundId: "re_2" })
    await expect(cancelBookingOrderForBuyer(ARGS)).resolves.toEqual({ ok: true, stripeRefundId: "re_2", refundPending: true })
    expect(m.refund).toHaveBeenCalledTimes(2)
    expect(m.releaseSeats).toHaveBeenCalledTimes(1)
  })

  it("does nothing more for an order already refunded", async () => {
    m.order!.status = "refunded"
    m.order!.paymentSettlementStatus = "REFUNDED"
    m.order!.bookingCancelledAt = new Date()

    await expect(cancelBookingOrderForBuyer(ARGS)).resolves.toEqual({ ok: true, refundPending: false })
    expect(m.refund).not.toHaveBeenCalled()
  })

  it("refuses another buyer", async () => {
    await expect(
      cancelBookingOrderForBuyer({ orderId: "o1", buyerUserId: "u2", buyerEmail: "other@example.com" })
    ).resolves.toMatchObject({ ok: false, status: 403 })
    expect(m.refund).not.toHaveBeenCalled()
  })
})
