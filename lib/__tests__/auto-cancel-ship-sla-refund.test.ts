import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  notificationCreateMany: vi.fn(),
  notificationUpdateMany: vi.fn(),
  cancelJob: vi.fn(),
  pipeline: vi.fn(),
  notify: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: h.findUnique, updateMany: h.updateMany, update: h.update },
    notification: { createMany: h.notificationCreateMany, updateMany: h.notificationUpdateMany },
  },
}))
vi.mock("@/lib/admin/orders/cancel-supplier-job", () => ({ cancelSupplierFulfillmentJob: h.cancelJob }))
vi.mock("@/lib/marketplace-refund-pipeline", () => ({ initiateMarketplaceRefundPipeline: h.pipeline }))
vi.mock("@/lib/emails/notify-order-cancelled", () => ({ notifyOrderCancelled: h.notify }))

import { autoCancelMarketplaceOrderShipSlaBreach } from "@/lib/orders/auto-cancel-ship-sla-breach"

const longAgo = new Date(Date.now() - 40 * 24 * 3600 * 1000)
const row = () => ({
  id: "o1",
  status: "paid",
  supplierId: "sup1",
  affiliateId: "aff1",
  autoCancelledAt: null,
  cancelledEmailSentAt: null,
  shipDeadlineAt: longAgo,
  paidAt: longAgo,
  createdAt: longAgo,
  trackingNumber: null,
  product: { name: "Widget" },
  supplierFulfillmentLinks: [],
  shipExtensions: [],
  fulfillmentMessages: [],
})
const orderUpdates = () => h.update.mock.calls.map(([a]) => a as { data: Record<string, unknown> })
const statusWrites = () => [...orderUpdates(), ...h.updateMany.mock.calls.map(([a]) => a as { data: Record<string, unknown> })].filter(
  (a) => a.data.status !== undefined
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "log").mockImplementation(() => {})
  h.findUnique.mockResolvedValue(row())
  h.updateMany.mockResolvedValue({ count: 1 })
  h.update.mockResolvedValue({})
  h.notificationCreateMany.mockResolvedValue({ count: 2 })
  h.notificationUpdateMany.mockResolvedValue({ count: 0 })
  h.cancelJob.mockResolvedValue({ ok: true })
  h.pipeline.mockResolvedValue({ ok: true, stripeRefundId: "re_1" })
})

describe("autoCancelMarketplaceOrderShipSlaBreach — engine jobs (#4)", () => {
  it("cancels the order's jobs ON BEHALF OF this order (a shared AliExpress job belongs to its first line only)", async () => {
    h.findUnique.mockResolvedValue({ ...row(), supplierFulfillmentLinks: [{ supplierFulfillmentOrderId: "job_1" }] })
    await autoCancelMarketplaceOrderShipSlaBreach("o1")
    expect(h.cancelJob).toHaveBeenCalledWith("job_1", { forOrderId: "o1" })
  })
})

describe("autoCancelMarketplaceOrderShipSlaBreach — D5", () => {
  it("success: refund created, supplier/affiliate notified, nothing marked `refunded` from here", async () => {
    const result = await autoCancelMarketplaceOrderShipSlaBreach("o1")
    expect(result).toMatchObject({ ok: true, refunded: true })
    expect(h.pipeline).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1", source: "ship_sla_auto_cancel" }))
    expect(h.notificationCreateMany).toHaveBeenCalledTimes(1)
    expect(statusWrites()).toHaveLength(0)
    expect(h.notify).not.toHaveBeenCalled()
  })

  it("a FAILED refund never marks the order `refunded` and never e-mails the buyer 'your refund is on its way'", async () => {
    h.pipeline.mockResolvedValue({ ok: false, error: "Stripe is down", retryable: true })
    const result = await autoCancelMarketplaceOrderShipSlaBreach("o1")

    expect(result).toMatchObject({ ok: false, refunded: false, error: "Stripe is down" })
    expect(statusWrites()).toHaveLength(0)
    expect(h.notify).not.toHaveBeenCalled()
    expect(h.notificationCreateMany).not.toHaveBeenCalled()
    const trace = orderUpdates().at(-1)?.data.fulfillmentErrors as Array<Record<string, unknown>>
    expect(trace[0]).toMatchObject({ refunded: false, refundError: "Stripe is down", retryable: true })
  })

  it("a transient failure RELEASES the claim so the next cron run retries; a permanent one keeps it for a person", async () => {
    h.pipeline.mockResolvedValue({ ok: false, error: "network", retryable: true })
    await autoCancelMarketplaceOrderShipSlaBreach("o1")
    const release = h.updateMany.mock.calls.find(([a]) => (a as { data: { autoCancelledAt?: null } }).data.autoCancelledAt === null)
    expect(release).toBeTruthy()
    expect((release?.[0] as { where: Record<string, unknown> }).where).toMatchObject({ id: "o1" })

    vi.clearAllMocks()
    h.findUnique.mockResolvedValue(row())
    h.updateMany.mockResolvedValue({ count: 1 })
    h.update.mockResolvedValue({})
    h.cancelJob.mockResolvedValue({ ok: true })
    h.pipeline.mockResolvedValue({ ok: false, error: "charge_already_refunded", retryable: false })
    const permanent = await autoCancelMarketplaceOrderShipSlaBreach("o1")
    expect(permanent.ok).toBe(false)
    const released = h.updateMany.mock.calls.some(([a]) => (a as { data: { autoCancelledAt?: null } }).data.autoCancelledAt === null)
    expect(released).toBe(false)
  })

  it("replay after a transient failure: the second run refunds and completes (stateful claim)", async () => {
    // Model the `autoCancelledAt` column: the claim is a compare-and-set, the release only undoes OUR claim.
    let autoCancelledAt: Date | null = null
    h.findUnique.mockImplementation(async () => ({ ...row(), autoCancelledAt }))
    h.updateMany.mockImplementation(async (args: { where: { autoCancelledAt?: Date | null }; data: { autoCancelledAt?: Date | null } }) => {
      if (!("autoCancelledAt" in args.data)) return { count: 1 }
      const expected = args.where.autoCancelledAt
      const matches = expected === null ? autoCancelledAt === null : autoCancelledAt?.getTime() === expected?.getTime()
      if (!matches) return { count: 0 }
      autoCancelledAt = args.data.autoCancelledAt ?? null
      return { count: 1 }
    })

    h.pipeline.mockResolvedValueOnce({ ok: false, error: "network", retryable: true })
    const first = await autoCancelMarketplaceOrderShipSlaBreach("o1")
    expect(first.ok).toBe(false)
    expect(autoCancelledAt).toBeNull() // released: the cron selects `autoCancelledAt: null`

    h.pipeline.mockResolvedValueOnce({ ok: true, stripeRefundId: "re_2" })
    const second = await autoCancelMarketplaceOrderShipSlaBreach("o1")
    expect(second).toMatchObject({ ok: true, refunded: true })
    expect(autoCancelledAt).not.toBeNull() // claimed for good once the refund exists
    expect(h.notificationCreateMany).toHaveBeenCalledTimes(1)

    // A third pass is refused (already cancelled): no second refund.
    const third = await autoCancelMarketplaceOrderShipSlaBreach("o1")
    expect(third).toMatchObject({ ok: false, skipped: "already_cancelled" })
    expect(h.pipeline).toHaveBeenCalledTimes(2)
  })

  it("`already_refunded` (webhook lag) counts as refunded", async () => {
    h.pipeline.mockResolvedValue({ ok: false, skipped: "already_refunded" })
    expect(await autoCancelMarketplaceOrderShipSlaBreach("o1")).toMatchObject({ ok: true, refunded: true })
  })
})
