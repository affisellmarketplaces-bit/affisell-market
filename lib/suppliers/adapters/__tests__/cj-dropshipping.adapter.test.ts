import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CjDropshippingSupplierAdapter, cjStatusToOrderStatus } from "@/lib/suppliers/adapters/cj-dropshipping.adapter"
import type { SupplierContext } from "@/lib/suppliers/dto"

function ctx(overrides: Partial<Record<string, unknown>> = {}): SupplierContext {
  return {
    id: `provider_${Math.random().toString(36).slice(2)}`,
    slug: "cj-test",
    name: "CJ Dropshipping (test)",
    type: "CJ_DROPSHIPPING",
    apiConfig: { email: "ops@affisell.test", apiKey: "cj-key-123", ...overrides },
    credentialsEncrypted: null,
    slaHours: 48,
  }
}

const validLine = { sku: "vid-123", quantity: 2, unitCostCents: 500, unitPriceCents: 1200 }
const shipping = {
  name: "Jane Buyer",
  line1: "10 Rue Test",
  city: "Paris",
  postal_code: "75001",
  country: "FR",
}

describe("cjStatusToOrderStatus", () => {
  it("maps CJ statuses to the shared order-status enum", () => {
    expect(cjStatusToOrderStatus("CANCELLED")).toBe("CANCELLED")
    expect(cjStatusToOrderStatus("DELIVERED")).toBe("DELIVERED")
    expect(cjStatusToOrderStatus("SHIPPED")).toBe("SHIPPED")
    expect(cjStatusToOrderStatus("UNPAID")).toBe("PENDING")
    expect(cjStatusToOrderStatus("CREATED")).toBe("PENDING")
    expect(cjStatusToOrderStatus(undefined)).toBe("CONFIRMED")
    expect(cjStatusToOrderStatus("IN_PRODUCTION")).toBe("CONFIRMED")
  })
})

describe("CjDropshippingSupplierAdapter", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
  }

  it("fails fast with a clear error when credentials are missing", async () => {
    const adapter = new CjDropshippingSupplierAdapter(ctx({ email: "", apiKey: "" }))
    const result = await adapter.placeOrder({ reference: "ref1", shipping, lines: [validLine] })
    expect(result.status).toBe("FAILED")
    expect(result.errorMessage).toContain("cj_missing_credentials")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("places and pays an order end to end", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ result: true, data: { accessToken: "tok_1", accessTokenExpiryDate: new Date(Date.now() + 86_400_000).toISOString() } })
      )
      .mockResolvedValueOnce(jsonResponse({ result: true, data: { orderId: "cj_order_1" } }))
      .mockResolvedValueOnce(jsonResponse({ result: true, data: {} }))

    const adapter = new CjDropshippingSupplierAdapter(ctx())
    const result = await adapter.placeOrder({ reference: "ref1", shipping, lines: [validLine] })

    expect(result.status).toBe("PROCESSING")
    expect(result.supplierOrderId).toBe("cj_order_1")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]![0]).toContain("/authentication/getAccessToken")
    expect(fetchMock.mock.calls[1]![0]).toContain("/shopping/order/createOrderV2")
    expect(fetchMock.mock.calls[2]![0]).toContain("/shopping/pay/payment")
  })

  it("reports an unpaid order instead of losing it when payment fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ result: true, data: { accessToken: "tok_1" } }))
      .mockResolvedValueOnce(jsonResponse({ result: true, data: { orderId: "cj_order_2" } }))
      .mockResolvedValueOnce(jsonResponse({ result: false, message: "insufficient_balance" }, false, 402))

    const adapter = new CjDropshippingSupplierAdapter(ctx())
    const result = await adapter.placeOrder({ reference: "ref2", shipping, lines: [validLine] })

    expect(result.status).toBe("PROCESSING")
    expect(result.supplierOrderId).toBe("cj_order_2")
    expect(result.errorMessage).toContain("unpaid:")
  })

  it("fails cleanly when order creation itself is rejected", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ result: true, data: { accessToken: "tok_1" } }))
      .mockResolvedValueOnce(jsonResponse({ result: false, message: "invalid_vid" }, false, 400))

    const adapter = new CjDropshippingSupplierAdapter(ctx())
    const result = await adapter.placeOrder({ reference: "ref3", shipping, lines: [validLine] })

    expect(result.status).toBe("FAILED")
    expect(result.supplierOrderId).toBeNull()
    expect(result.errorMessage).toContain("invalid_vid")
  })

  it("caches the access token across calls instead of re-authenticating every time", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ result: true, data: { accessToken: "tok_shared", accessTokenExpiryDate: new Date(Date.now() + 86_400_000).toISOString() } })
      )
      .mockResolvedValueOnce(jsonResponse({ result: true, data: { orderStatus: "SHIPPED", trackNumber: "T1", logisticName: "CJPacket" } }))
      .mockResolvedValueOnce(jsonResponse({ result: true, data: { orderStatus: "DELIVERED" } }))

    // Two adapters sharing the same provider id + email hit the in-process token cache.
    const providerCtx = ctx()
    const a1 = new CjDropshippingSupplierAdapter(providerCtx)
    const a2 = new CjDropshippingSupplierAdapter(providerCtx)

    const s1 = await a1.getOrderStatus("cj_order_1")
    const s2 = await a2.getOrderStatus("cj_order_1")

    expect(s1.status).toBe("SHIPPED")
    expect(s1.trackingNumber).toBe("T1")
    expect(s2.status).toBe("DELIVERED")
    // Only one auth call for two order-status calls.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("rejects margin-losing lines before calling the API", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: true, data: { accessToken: "tok_1" } }))
    const adapter = new CjDropshippingSupplierAdapter(ctx())
    await expect(
      adapter.placeOrder({
        reference: "ref-loss",
        shipping,
        lines: [{ sku: "vid-loss", quantity: 1, unitCostCents: 1200, unitPriceCents: 1250 }],
      })
    ).rejects.toThrow(/margin/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
