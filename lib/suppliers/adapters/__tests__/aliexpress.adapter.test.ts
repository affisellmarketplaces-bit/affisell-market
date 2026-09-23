import { beforeEach, describe, expect, it, vi } from "vitest"

const { cancelAliExpressDsOrderMock } = vi.hoisted(() => ({
  cancelAliExpressDsOrderMock: vi.fn(),
}))

vi.mock("@/lib/aliexpress-ds-cancel-order", () => ({
  cancelAliExpressDsOrder: cancelAliExpressDsOrderMock,
}))

import { AliExpressSupplierAdapter } from "@/lib/suppliers/adapters/aliexpress.adapter"
import type { SupplierContext } from "@/lib/suppliers/dto"

function ctx(): SupplierContext {
  return {
    id: "provider_ae_test",
    slug: "ae-test",
    name: "AliExpress (test)",
    type: "ALIEXPRESS",
    apiConfig: {},
    credentialsEncrypted: null,
    slaHours: 48,
  }
}

describe("AliExpressSupplierAdapter.cancelOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resolves when AliExpress's afterpay API accepts the cancellation request", async () => {
    cancelAliExpressDsOrderMock.mockResolvedValue({
      ok: true,
      requested: true,
      orderStatusAfter: "WAIT_SELLER_SEND_GOODS",
      host: "https://api-sg.aliexpress.com/sync",
    })
    const adapter = new AliExpressSupplierAdapter(ctx())
    await expect(adapter.cancelOrder("ae-order-123")).resolves.toBeUndefined()
    expect(cancelAliExpressDsOrderMock).toHaveBeenCalledWith("ae-order-123")
  })

  it("throws not_supported when the afterpay API declines the request — never a silent false success", async () => {
    cancelAliExpressDsOrderMock.mockResolvedValue({
      ok: true,
      requested: false,
      orderStatusAfter: "WAIT_SELLER_SEND_GOODS",
      host: "https://api-sg.aliexpress.com/sync",
    })
    const adapter = new AliExpressSupplierAdapter(ctx())
    await expect(adapter.cancelOrder("ae-order-124")).rejects.toThrow(/not_supported/)
  })

  it("throws not_supported when the AliExpress call itself fails", async () => {
    cancelAliExpressDsOrderMock.mockResolvedValue({ ok: false, error: "aliexpress_api_not_configured" })
    const adapter = new AliExpressSupplierAdapter(ctx())
    await expect(adapter.cancelOrder("ae-order-125")).rejects.toThrow(/not_supported/)
  })
})
