import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  cancelJob: vi.fn(),
  notify: vi.fn(),
  pipeline: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: h.findUnique, update: h.update } } }))
vi.mock("@/lib/admin/orders/cancel-supplier-job", () => ({ cancelSupplierFulfillmentJob: h.cancelJob }))
vi.mock("@/lib/emails/notify-order-cancelled", () => ({ notifyOrderCancelled: h.notify }))
vi.mock("@/lib/marketplace-refund-pipeline", () => ({ initiateMarketplaceRefundPipeline: h.pipeline }))

import { cancelMarketplaceOrderByAdmin } from "@/lib/admin/orders/cancel-marketplace-order"

const order = (patch: Record<string, unknown> = {}) => ({
  id: "o1",
  status: "paid",
  paidAt: new Date("2026-11-01T10:00:00Z"),
  stripeChargeId: "ch_1",
  paymentSettlementStatus: "PAID",
  supplierFulfillmentLinks: [{ supplierFulfillmentOrderId: "job_1" }],
  ...patch,
})
const statusWritten = () =>
  h.update.mock.calls.map(([a]) => (a as { data: Record<string, unknown> }).data.status).filter((s) => s !== undefined)

beforeEach(() => {
  vi.clearAllMocks()
  h.findUnique.mockResolvedValue(order())
  h.cancelJob.mockResolvedValue({ ok: true })
  h.update.mockResolvedValue({})
  h.notify.mockResolvedValue({ sent: true })
  h.pipeline.mockResolvedValue({ ok: true, stripeRefundId: "re_1" })
})

describe("cancelMarketplaceOrderByAdmin — engine jobs are cancelled ON BEHALF OF this order (#4)", () => {
  it("tells cancelSupplierFulfillmentJob which order is being cancelled (a shared AliExpress job belongs to its first line only)", async () => {
    await cancelMarketplaceOrderByAdmin("o1", "SAV")
    expect(h.cancelJob).toHaveBeenCalledWith("job_1", { forOrderId: "o1" })
  })
})

describe("cancelMarketplaceOrderByAdmin — D5: `refunded` only after a real refund", () => {
  it("refunds a paid order through the pipeline (admin_refund) and only THEN passes the refund id to the e-mail/status writer", async () => {
    h.pipeline.mockImplementation(async () => {
      // At the time Stripe is called, nothing may have been marked refunded yet.
      expect(h.notify).not.toHaveBeenCalled()
      expect(statusWritten()).toHaveLength(0)
      return { ok: true, stripeRefundId: "re_1" }
    })
    const result = await cancelMarketplaceOrderByAdmin("o1", "SAV")

    expect(result).toMatchObject({ ok: true, emailSent: true, stripeRefundId: "re_1" })
    expect(h.pipeline).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1", source: "admin_refund" }))
    expect(h.notify).toHaveBeenCalledWith("o1", expect.objectContaining({ stripeRefundId: "re_1", cancelReason: "SAV" }))
  })

  it("when the Stripe refund FAILS: the order is not marked refunded, no e-mail, the failure is reported and the call is replayable", async () => {
    h.pipeline.mockResolvedValue({ ok: false, error: "Stripe is down", retryable: true })
    const result = await cancelMarketplaceOrderByAdmin("o1")

    expect(result).toMatchObject({ ok: false, error: "Stripe is down", refundFailed: true, retryable: true })
    expect(h.notify).not.toHaveBeenCalled()
    expect(statusWritten()).toHaveLength(0)
    const trace = h.update.mock.calls.at(-1)?.[0].data.fulfillmentErrors[0]
    expect(trace).toMatchObject({ source: "admin_cancel", refunded: false, refundError: "Stripe is down", retryable: true })

    // Replay: same input, Stripe is back → the refund goes through and the order is finally marked refunded.
    h.pipeline.mockResolvedValue({ ok: true, stripeRefundId: "re_2" })
    h.cancelJob.mockResolvedValue({ ok: false, error: "not_cancellable" }) // the job is already cancelled: tolerated
    const replay = await cancelMarketplaceOrderByAdmin("o1")
    expect(replay).toMatchObject({ ok: true, stripeRefundId: "re_2" })
    expect(h.notify).toHaveBeenCalledWith("o1", expect.objectContaining({ stripeRefundId: "re_2" }))
  })

  it("treats a refund that is already there (webhook lag) as done, without inventing a refund id", async () => {
    h.pipeline.mockResolvedValue({ ok: false, skipped: "already_refunded" })
    const result = await cancelMarketplaceOrderByAdmin("o1")
    expect(result.ok).toBe(true)
    expect(h.notify).toHaveBeenCalledWith("o1", expect.objectContaining({ stripeRefundId: undefined }))
  })

  it("an order that was never paid has nothing to refund: it becomes `cancelled`, never `refunded`, and Stripe is not called", async () => {
    h.findUnique.mockResolvedValue(
      order({ status: "PENDING", paidAt: null, stripeChargeId: null, paymentSettlementStatus: "PENDING" })
    )
    const result = await cancelMarketplaceOrderByAdmin("o1")

    expect(result.ok).toBe(true)
    expect(h.pipeline).not.toHaveBeenCalled()
    expect(statusWritten()).toEqual(["cancelled"])
    expect(h.notify.mock.calls[0][1]).not.toHaveProperty("stripeRefundId")
  })

  it.each([{ status: "refunded" }, { paymentSettlementStatus: "REFUNDED" }])(
    "refuses an order that is already refunded (%j)",
    async (patch) => {
      h.findUnique.mockResolvedValue(order(patch))
      expect(await cancelMarketplaceOrderByAdmin("o1")).toEqual({ ok: false, error: "already_refunded" })
      expect(h.pipeline).not.toHaveBeenCalled()
      expect(h.cancelJob).not.toHaveBeenCalled()
    }
  )

  it("stops before any refund when a supplier job cannot be cancelled", async () => {
    h.cancelJob.mockResolvedValue({ ok: false, error: "supplier_api_error" })
    expect(await cancelMarketplaceOrderByAdmin("o1")).toEqual({ ok: false, error: "supplier_api_error" })
    expect(h.pipeline).not.toHaveBeenCalled()
  })
})
