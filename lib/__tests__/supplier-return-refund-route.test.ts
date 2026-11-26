import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  pipeline: vi.fn(),
  reverseReward: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: h.auth }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orderReturn: {
      findFirst: h.findFirst,
      updateMany: h.updateMany,
      update: h.update,
      findUniqueOrThrow: h.findUniqueOrThrow,
    },
  },
}))
vi.mock("@/lib/marketplace-refund-pipeline", () => ({ initiateMarketplaceRefundPipeline: h.pipeline }))
vi.mock("@/lib/buyer-reward-ledger", () => ({ reverseBuyerRewardEarnOnRefund: h.reverseReward }))
vi.mock("@/lib/supplier-retail-veil", () => ({
  assertNoSupplierRetailLeak: vi.fn(),
  supplierReturnLiabilityCents: () => 4200,
}))

import { PATCH } from "@/app/api/supplier/returns/[returnId]/route"

type ReturnRow = Record<string, unknown>
let stored: ReturnRow

const baseReturn = (): ReturnRow => ({
  id: "ret_1",
  orderId: "ord_1",
  status: "RECEIVED",
  requestedRefundCents: 5000,
  approvedRefundCents: 3000,
  sellerNote: null,
  refundedAt: null,
  order: { id: "ord_1", sellingPriceCents: 5000 },
})

const patch = (action = "mark_refunded") =>
  PATCH(
    new Request("http://localhost/api/supplier/returns/ret_1", {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ returnId: "ret_1" }) }
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
  stored = baseReturn()
  h.auth.mockResolvedValue({ user: { id: "sup1", role: "SUPPLIER" } })
  h.findFirst.mockImplementation(async () => ({ ...stored }))
  // Compare-and-set on the status, like the database would.
  h.updateMany.mockImplementation(async (args: { where: { status?: string }; data: ReturnRow }) => {
    if (args.where.status !== undefined && args.where.status !== stored.status) return { count: 0 }
    stored = { ...stored, ...args.data }
    return { count: 1 }
  })
  h.update.mockImplementation(async (args: { data: ReturnRow }) => {
    stored = { ...stored, ...args.data }
    return { ...stored }
  })
  h.findUniqueOrThrow.mockImplementation(async () => ({ ...stored }))
  h.pipeline.mockResolvedValue({ ok: true, stripeRefundId: "re_1" })
  h.reverseReward.mockResolvedValue(undefined)
})

describe("PATCH /api/supplier/returns/[returnId] mark_refunded — D5", () => {
  it("success: Stripe is called first with the approved amount, THEN the return becomes REFUNDED", async () => {
    h.pipeline.mockImplementation(async () => {
      // Stripe is being called: the return must still be RECEIVED.
      expect(stored.status).toBe("RECEIVED")
      return { ok: true, stripeRefundId: "re_1" }
    })
    const res = await patch()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ id: "ret_1", status: "REFUNDED" })
    expect(h.pipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_1",
        source: "supplier_mark_refunded",
        amountCents: 3000,
        metadata: { returnId: "ret_1" },
      })
    )
    expect(stored.status).toBe("REFUNDED")
    expect(h.reverseReward).toHaveBeenCalledTimes(1)
  })

  it("a FAILED refund leaves the return RECEIVED (replayable), answers 502, reverses no reward", async () => {
    h.pipeline.mockResolvedValue({ ok: false, error: "Stripe is down", retryable: true })
    const res = await patch()
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body).toMatchObject({ error: "Stripe is down", retryable: true, status: "RECEIVED" })
    expect(stored.status).toBe("RECEIVED")
    expect(stored.refundedAt).toBeNull()
    expect(h.updateMany).not.toHaveBeenCalled()
    expect(h.reverseReward).not.toHaveBeenCalled()
  })

  it("the same PATCH can be replayed after the failure and then completes", async () => {
    h.pipeline.mockResolvedValueOnce({ ok: false, error: "Stripe is down", retryable: true })
    expect((await patch()).status).toBe(502)

    h.pipeline.mockResolvedValueOnce({ ok: true, stripeRefundId: "re_2" })
    const replay = await patch()
    expect(replay.status).toBe(200)
    expect(stored.status).toBe("REFUNDED")
    expect(h.pipeline).toHaveBeenCalledTimes(2)
    // Same arguments both times: the refund's idempotency key is derived from them (see stripe-refund-marketplace-order.test).
    expect(h.pipeline.mock.calls[0][0]).toEqual(h.pipeline.mock.calls[1][0])
  })

  it("an invalid approved amount (0) is refused with 422 and the return stays RECEIVED", async () => {
    stored.approvedRefundCents = 0
    h.pipeline.mockResolvedValue({ ok: false, error: "invalid_refund_amount", retryable: false })
    const res = await patch()
    expect(res.status).toBe(422)
    expect(stored.status).toBe("RECEIVED")
  })

  it("an order that is already refunded still closes the return, without a second refund", async () => {
    h.pipeline.mockResolvedValue({ ok: false, skipped: "already_refunded" })
    const res = await patch()
    expect(res.status).toBe(200)
    expect(stored.status).toBe("REFUNDED")
  })

  it("a double click moves the return once and reverses the reward once", async () => {
    // The second request read the row before the first one finished: both see RECEIVED, only one wins the compare-and-set.
    const snapshot = baseReturn()
    h.findFirst.mockImplementation(async () => ({ ...snapshot }))
    const [a, b] = await Promise.all([patch(), patch()])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(stored.status).toBe("REFUNDED")
    expect(h.reverseReward).toHaveBeenCalledTimes(1)
  })

  it("a reward-reversal failure after the money moved does not turn the response into an error", async () => {
    h.reverseReward.mockRejectedValue(new Error("db"))
    const res = await patch()
    expect(res.status).toBe(200)
    expect(stored.status).toBe("REFUNDED")
  })

  it("refuses the transition from any status other than RECEIVED without calling Stripe", async () => {
    stored.status = "REFUNDED"
    const res = await patch()
    expect(res.status).toBe(400)
    expect(h.pipeline).not.toHaveBeenCalled()
  })
})
