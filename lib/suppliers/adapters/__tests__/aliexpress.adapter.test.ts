import { describe, expect, it } from "vitest"

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
  it("throws not_supported rather than silently reporting success — there is no cancel/after-sales API wired for AliExpress", async () => {
    const adapter = new AliExpressSupplierAdapter(ctx())
    await expect(adapter.cancelOrder("ae-order-123")).rejects.toThrow(/not_supported/)
  })
})
