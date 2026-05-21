import { describe, expect, it } from "vitest"

import { MarginTooLowError } from "@/lib/suppliers/base.adapter"
import { NativeSupplierAdapter } from "@/lib/suppliers/adapters/native.adapter"
import type { SupplierContext } from "@/lib/suppliers/dto"

const ctx: SupplierContext = {
  id: "test",
  slug: "test-native",
  name: "Test",
  type: "AFFISELL_NATIVE",
  apiConfig: {},
  credentialsEncrypted: null,
  slaHours: 24,
}

describe("supplier margin guard", () => {
  it("rejects when cost >= 85% of retail (15% min margin)", async () => {
    const adapter = new NativeSupplierAdapter(ctx)
    await expect(
      adapter.placeOrder({
        reference: "ref-1",
        shipping: { line1: "1 rue Test", city: "Paris", country: "FR" },
        lines: [{ sku: "SKU1", quantity: 1, unitCostCents: 850, unitPriceCents: 1000 }],
      })
    ).rejects.toBeInstanceOf(MarginTooLowError)
  })

  it("accepts healthy margin", async () => {
    const adapter = new NativeSupplierAdapter(ctx)
    const res = await adapter.placeOrder({
      reference: "ref-2",
      shipping: { line1: "1 rue Test", city: "Paris", country: "FR" },
      lines: [{ sku: "SKU1", quantity: 1, unitCostCents: 500, unitPriceCents: 1000 }],
    })
    expect(res.status).toBe("CONFIRMED")
    expect(res.supplierOrderId).toMatch(/^native-/)
  })
})
