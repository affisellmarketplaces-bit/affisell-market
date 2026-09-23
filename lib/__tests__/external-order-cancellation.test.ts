import { describe, expect, it, vi, beforeEach } from "vitest"

const {
  fulfillmentLogFindUniqueMock,
  fulfillmentLogUpdateMock,
  lineFindFirstMock,
  supplierFulfillmentOrderUpdateMock,
  resolveAdapterMock,
  cancelOrderMock,
} = vi.hoisted(() => ({
  fulfillmentLogFindUniqueMock: vi.fn(),
  fulfillmentLogUpdateMock: vi.fn(),
  lineFindFirstMock: vi.fn(),
  supplierFulfillmentOrderUpdateMock: vi.fn(),
  resolveAdapterMock: vi.fn(),
  cancelOrderMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fulfillmentLog: {
      findUnique: fulfillmentLogFindUniqueMock,
      update: fulfillmentLogUpdateMock,
    },
    supplierFulfillmentOrderLine: {
      findFirst: lineFindFirstMock,
    },
    supplierFulfillmentOrder: {
      update: supplierFulfillmentOrderUpdateMock,
    },
  },
}))

vi.mock("@/lib/suppliers/place-order-bridge", () => ({
  resolveSupplierAdapterForGroup: resolveAdapterMock,
}))

import { attemptExternalOrderCancellation } from "@/lib/fulfillment/external-order-cancellation"

describe("attemptExternalOrderCancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lineFindFirstMock.mockResolvedValue(null)
  })

  it("returns not_applicable when nothing was ever purchased upstream", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue(null)
    const result = await attemptExternalOrderCancellation("order_1")
    expect(result).toEqual({ outcome: "not_applicable" })
    expect(fulfillmentLogUpdateMock).not.toHaveBeenCalled()
  })

  it("returns not_applicable for a FulfillmentLog that never reached BOUGHT (e.g. auto-buy already failed/refunded)", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "REFUNDED",
      aeOrderId: null,
      externalCancelStatus: "NOT_ATTEMPTED",
    })
    const result = await attemptExternalOrderCancellation("order_2")
    expect(result).toEqual({ outcome: "not_applicable" })
  })

  it("flags AliExpress auto-buy orders as manual_required — no automated cancel API exists", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: "ae-123",
      externalCancelStatus: "NOT_ATTEMPTED",
    })
    const result = await attemptExternalOrderCancellation("order_3")
    expect(result).toEqual({ outcome: "manual_required", reason: "aliexpress_no_cancel_api", channel: "ALIEXPRESS" })
    expect(fulfillmentLogUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: "order_3" },
        data: expect.objectContaining({ externalCancelStatus: "MANUAL_REQUIRED" }),
      })
    )
  })

  it("is idempotent — a second call on an already-handled AE order doesn't re-alert", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: "ae-123",
      externalCancelStatus: "MANUAL_REQUIRED",
    })
    const result = await attemptExternalOrderCancellation("order_4")
    expect(result).toEqual({ outcome: "already_handled", status: "MANUAL_REQUIRED" })
    expect(fulfillmentLogUpdateMock).not.toHaveBeenCalled()
  })

  it("actually cancels via a trusted channel (CJ Dropshipping) and marks the job cancelled", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue(null)
    lineFindFirstMock.mockResolvedValue({
      supplierFulfillmentOrder: {
        id: "sfo_1",
        fulfillmentProviderId: "prov_1",
        supplierOrderId: "cj-999",
        status: "PROCESSING",
        externalCancelStatus: "NOT_ATTEMPTED",
        provider: { channelType: "CJ_DROPSHIPPING" },
      },
    })
    cancelOrderMock.mockResolvedValue(undefined)
    resolveAdapterMock.mockResolvedValue({ cancelOrder: cancelOrderMock })

    const result = await attemptExternalOrderCancellation("order_5")

    expect(cancelOrderMock).toHaveBeenCalledWith("cj-999")
    expect(result).toEqual({ outcome: "cancelled" })
    expect(supplierFulfillmentOrderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sfo_1" },
        data: expect.objectContaining({ status: "CANCELLED", externalCancelStatus: "CANCELLED" }),
      })
    )
  })

  it("marks failed (not cancelled) when a trusted channel's cancel call throws", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue(null)
    lineFindFirstMock.mockResolvedValue({
      supplierFulfillmentOrder: {
        id: "sfo_2",
        fulfillmentProviderId: "prov_1",
        supplierOrderId: "cj-888",
        status: "PROCESSING",
        externalCancelStatus: "NOT_ATTEMPTED",
        provider: { channelType: "CJ_DROPSHIPPING" },
      },
    })
    cancelOrderMock.mockRejectedValue(new Error("cj_api_down"))
    resolveAdapterMock.mockResolvedValue({ cancelOrder: cancelOrderMock })

    const result = await attemptExternalOrderCancellation("order_6")

    expect(result).toEqual({ outcome: "failed", error: "cj_api_down", channel: "CJ_DROPSHIPPING" })
    expect(supplierFulfillmentOrderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ externalCancelStatus: "FAILED" }) })
    )
  })

  it("never trusts an unverified channel's cancelOrder — flags manual_required without even calling the adapter", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue(null)
    lineFindFirstMock.mockResolvedValue({
      supplierFulfillmentOrder: {
        id: "sfo_3",
        fulfillmentProviderId: "prov_2",
        supplierOrderId: "temu-1",
        status: "PROCESSING",
        externalCancelStatus: "NOT_ATTEMPTED",
        provider: { channelType: "TEMU" },
      },
    })

    const result = await attemptExternalOrderCancellation("order_7")

    expect(result).toEqual({ outcome: "manual_required", reason: "channel_cancel_not_verified", channel: "TEMU" })
    expect(resolveAdapterMock).not.toHaveBeenCalled()
  })

  it("flags manual_required instead of attempting a cancel once the order already shipped", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue(null)
    lineFindFirstMock.mockResolvedValue({
      supplierFulfillmentOrder: {
        id: "sfo_4",
        fulfillmentProviderId: "prov_1",
        supplierOrderId: "cj-777",
        status: "SHIPPED",
        externalCancelStatus: "NOT_ATTEMPTED",
        provider: { channelType: "CJ_DROPSHIPPING" },
      },
    })

    const result = await attemptExternalOrderCancellation("order_8")

    expect(result).toEqual({ outcome: "manual_required", reason: "already_shipped_or_terminal", channel: "CJ_DROPSHIPPING" })
    expect(resolveAdapterMock).not.toHaveBeenCalled()
  })

  it("returns not_applicable when no external order exists at all (native catalog order)", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue(null)
    lineFindFirstMock.mockResolvedValue(null)

    const result = await attemptExternalOrderCancellation("order_9")

    expect(result).toEqual({ outcome: "not_applicable" })
  })
})
