import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { callAliExpressSyncMethodMock, getValidAccessTokenMock, isConfiguredMock } = vi.hoisted(() => ({
  callAliExpressSyncMethodMock: vi.fn(),
  getValidAccessTokenMock: vi.fn(),
  isConfiguredMock: vi.fn(),
}))

vi.mock("@/lib/aliexpress-ds-sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aliexpress-ds-sync")>("@/lib/aliexpress-ds-sync")
  return { ...actual, callAliExpressSyncMethod: callAliExpressSyncMethodMock }
})

vi.mock("@/lib/aliexpress-oauth", () => ({
  getValidAccessToken: getValidAccessTokenMock,
}))

vi.mock("@/lib/aliexpress-open-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aliexpress-open-api")>("@/lib/aliexpress-open-api")
  return {
    ...actual,
    AliExpressClient: { ...actual.AliExpressClient, isConfigured: isConfiguredMock },
  }
})

import { cancelAliExpressDsOrder } from "@/lib/aliexpress-ds-cancel-order"

describe("cancelAliExpressDsOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects an empty order id without calling anything", async () => {
    const result = await cancelAliExpressDsOrder("  ")
    expect(result).toEqual({ ok: false, error: "missing_order_id" })
    expect(isConfiguredMock).not.toHaveBeenCalled()
  })

  it("short-circuits in AE_DRY_RUN mode without hitting the real API", async () => {
    vi.stubEnv("AE_DRY_RUN", "true")
    const result = await cancelAliExpressDsOrder("ae-1")
    expect(result).toEqual({ ok: true, requested: true, orderStatusAfter: null, host: "dry_run" })
    expect(callAliExpressSyncMethodMock).not.toHaveBeenCalled()
  })

  it("fails cleanly when AliExpress credentials aren't configured", async () => {
    isConfiguredMock.mockReturnValue(false)
    const result = await cancelAliExpressDsOrder("ae-2")
    expect(result).toEqual({ ok: false, error: "aliexpress_api_not_configured" })
  })

  it("calls aliexpress.ds.order.afterpay with the order id and reports requested=true on success", async () => {
    isConfiguredMock.mockReturnValue(true)
    getValidAccessTokenMock.mockResolvedValue("token-abc")
    callAliExpressSyncMethodMock
      .mockResolvedValueOnce({
        aliexpress_ds_order_afterpay_response: { result: true, rsp_code: "200", rsp_msg: "ok" },
      })
      .mockResolvedValueOnce({
        aliexpress_trade_ds_order_get_response: { result: { order_status: "SELLER_PART_SENDING_GOODS" } },
      })

    const result = await cancelAliExpressDsOrder("ae-3")

    expect(result).toEqual({
      ok: true,
      requested: true,
      orderStatusAfter: "SELLER_PART_SENDING_GOODS",
      host: "https://api-sg.aliexpress.com/sync",
    })
    expect(callAliExpressSyncMethodMock.mock.calls[0]?.[0]).toMatchObject({
      method: "aliexpress.ds.order.afterpay",
      bizParams: { req: JSON.stringify({ order_id: "ae-3" }) },
    })
  })

  it("reports requested=false when AliExpress declines the cancellation", async () => {
    isConfiguredMock.mockReturnValue(true)
    getValidAccessTokenMock.mockResolvedValue("token-abc")
    callAliExpressSyncMethodMock
      .mockResolvedValueOnce({
        aliexpress_ds_order_afterpay_response: { result: false, rsp_code: "200", rsp_msg: "not eligible" },
      })
      .mockResolvedValueOnce({ aliexpress_trade_ds_order_get_response: { result: { order_status: "SHIPPED" } } })

    const result = await cancelAliExpressDsOrder("ae-4")

    expect(result).toEqual({ ok: true, requested: false, orderStatusAfter: "SHIPPED", host: "https://api-sg.aliexpress.com/sync" })
  })

  it("falls back to the second host when the first host's call fails, and still succeeds", async () => {
    isConfiguredMock.mockReturnValue(true)
    getValidAccessTokenMock.mockResolvedValue("token-abc")
    callAliExpressSyncMethodMock
      .mockRejectedValueOnce(new Error("isv.api-not-exist"))
      .mockResolvedValueOnce({
        aliexpress_ds_order_afterpay_response: { result: true, rsp_code: "200", rsp_msg: "ok" },
      })
      .mockResolvedValueOnce({ aliexpress_trade_ds_order_get_response: { result: { order_status: "CANCEL" } } })

    const result = await cancelAliExpressDsOrder("ae-5")

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.requested).toBe(true)
      expect(result.host).toBe("https://api.aliexpress.com/sync")
    }
  })

  it("returns ok:false when every host fails", async () => {
    isConfiguredMock.mockReturnValue(true)
    getValidAccessTokenMock.mockResolvedValue("token-abc")
    callAliExpressSyncMethodMock.mockRejectedValue(new Error("network_down"))

    const result = await cancelAliExpressDsOrder("ae-6")

    expect(result).toEqual({ ok: false, error: "network_down" })
  })

  it("still returns the cancel result when the status re-check fails", async () => {
    isConfiguredMock.mockReturnValue(true)
    getValidAccessTokenMock.mockResolvedValue("token-abc")
    callAliExpressSyncMethodMock
      .mockResolvedValueOnce({
        aliexpress_ds_order_afterpay_response: { result: true, rsp_code: "200", rsp_msg: "ok" },
      })
      .mockRejectedValueOnce(new Error("status_query_timeout"))

    const result = await cancelAliExpressDsOrder("ae-7")

    expect(result).toEqual({
      ok: true,
      requested: true,
      orderStatusAfter: null,
      host: "https://api-sg.aliexpress.com/sync",
    })
  })
})
