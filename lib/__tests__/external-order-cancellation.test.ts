import { describe, expect, it, vi, beforeEach } from "vitest"

const {
  fulfillmentLogFindUniqueMock,
  fulfillmentLogUpdateMock,
  lineFindFirstMock,
  supplierFulfillmentOrderUpdateMock,
  resolveAdapterMock,
  cancelOrderMock,
  cancelAliExpressDsOrderMock,
} = vi.hoisted(() => ({
  fulfillmentLogFindUniqueMock: vi.fn(),
  fulfillmentLogUpdateMock: vi.fn(),
  lineFindFirstMock: vi.fn(),
  supplierFulfillmentOrderUpdateMock: vi.fn(),
  resolveAdapterMock: vi.fn(),
  cancelOrderMock: vi.fn(),
  cancelAliExpressDsOrderMock: vi.fn(),
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

vi.mock("@/lib/aliexpress-ds-cancel-order", () => ({
  cancelAliExpressDsOrder: cancelAliExpressDsOrderMock,
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

  it("marks REQUESTED (not CANCELLED) when AliExpress's afterpay API accepts the cancellation", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: "ae-123",
      externalCancelStatus: "NOT_ATTEMPTED",
    })
    cancelAliExpressDsOrderMock.mockResolvedValue({
      ok: true,
      requested: true,
      orderStatusAfter: "WAIT_SELLER_SEND_GOODS",
      host: "https://api-sg.aliexpress.com/sync",
    })

    const result = await attemptExternalOrderCancellation("order_3")

    expect(cancelAliExpressDsOrderMock).toHaveBeenCalledWith("ae-123")
    expect(result.outcome).toBe("requested")
    expect(fulfillmentLogUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: "order_3" },
        data: expect.objectContaining({ externalCancelStatus: "REQUESTED" }),
      })
    )
  })

  it("falls back to manual_required when AliExpress declines the cancellation request", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: "ae-124",
      externalCancelStatus: "NOT_ATTEMPTED",
    })
    cancelAliExpressDsOrderMock.mockResolvedValue({
      ok: true,
      requested: false,
      orderStatusAfter: "WAIT_SELLER_SEND_GOODS",
      host: "https://api-sg.aliexpress.com/sync",
    })

    const result = await attemptExternalOrderCancellation("order_3b")

    expect(result).toEqual({
      outcome: "manual_required",
      reason: "aliexpress_afterpay_declined",
      channel: "ALIEXPRESS",
    })
  })

  it("falls back to manual_required when the AliExpress API call itself fails", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: "ae-125",
      externalCancelStatus: "NOT_ATTEMPTED",
    })
    cancelAliExpressDsOrderMock.mockResolvedValue({ ok: false, error: "aliexpress_api_not_configured" })

    const result = await attemptExternalOrderCancellation("order_3c")

    expect(result).toEqual({
      outcome: "manual_required",
      reason: "aliexpress_api_not_configured",
      channel: "ALIEXPRESS",
    })
  })

  it("flags manual_required without calling the AliExpress API when aeOrderId is missing", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: null,
      externalCancelStatus: "NOT_ATTEMPTED",
    })

    const result = await attemptExternalOrderCancellation("order_3d")

    expect(cancelAliExpressDsOrderMock).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: "manual_required", reason: "missing_ae_order_id", channel: "ALIEXPRESS" })
  })

  it("is idempotent — a second call on an already-handled AE order doesn't re-attempt", async () => {
    fulfillmentLogFindUniqueMock.mockResolvedValue({
      status: "BOUGHT",
      aeOrderId: "ae-123",
      externalCancelStatus: "MANUAL_REQUIRED",
    })
    const result = await attemptExternalOrderCancellation("order_4")
    expect(result).toEqual({ outcome: "already_handled", status: "MANUAL_REQUIRED" })
    expect(fulfillmentLogUpdateMock).not.toHaveBeenCalled()
    expect(cancelAliExpressDsOrderMock).not.toHaveBeenCalled()
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
