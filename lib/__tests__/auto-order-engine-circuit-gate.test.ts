/**
 * Engine ↔ per-order purchase gate: a job the gate turned away must not be counted as a PROVIDER failure.
 * Five circuit failures open the breaker for 60 s for every AliExpress group of the process, so a burst of margin refusals or
 * refused duplicates would otherwise stop all AliExpress fulfilment for a minute.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  placed: { supplierOrderId: null, status: "FAILED", errorMessage: "x" } as Record<string, unknown>,
  circuitFailures: [] as string[],
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: async () => [
        {
          id: "o1",
          productId: "p1",
          quantity: 1,
          sellingPriceCents: 9000,
          variantLabel: null,
          customerEmail: "buyer@example.test",
          shippingAddress: {},
          product: { id: "p1", name: "P", basePriceCents: 3000, variants: null, supplierSku: "SKU", sourceSkuId: null },
        },
      ],
      updateMany: async () => ({ count: 1 }),
    },
    autoFulfillmentBatch: {
      findUnique: async () => ({ id: "b1" }),
      create: async () => ({ id: "b1" }),
      update: async () => ({}),
    },
    fulfillmentProvider: {
      findUnique: async () => ({ id: "prov1", status: "ACTIVE", paymentMethod: "INVOICE_NET30", channelType: "ALIEXPRESS" }),
    },
    supplierFulfillmentOrder: { create: async () => ({ id: "job1" }) },
  },
}))
vi.mock("@/lib/auto-order/circuit-breaker", () => ({
  assertCircuitClosed: () => undefined,
  recordCircuitFailure: (k: string) => void h.circuitFailures.push(k),
  recordCircuitSuccess: () => undefined,
}))
vi.mock("@/lib/auto-order/resolve-channel", () => ({
  resolveFulfillmentChannel: async () => ({ channel: "ALIEXPRESS", providerId: "prov1" }),
}))
vi.mock("@/lib/auto-order/payment", () => ({ executeSupplierPayment: async () => ({ ok: true, reference: "no_payment_required" }) }))
vi.mock("@/lib/suppliers/place-order-resilient", () => ({ dispatchPlaceSupplierOrder: async () => h.placed }))
vi.mock("@/lib/auto-order/apply-place-result", () => ({
  applySupplierPlaceOrderResult: async () => ({ success: false, lineStatus: "PROCESSING", errorMessage: h.placed.errorMessage }),
}))
vi.mock("@/lib/auto-order/batch-finalize", () => ({ finalizeAutoFulfillmentBatch: async () => ({ batchId: "b1", fulfillmentStatus: "FAILED", jobs: [] }) }))
vi.mock("@/lib/auto-order/redis", () => ({ isAutoOrderQueueEnabled: () => false }))
vi.mock("@/lib/auto-order/telemetry", () => ({ logAutoOrder: () => undefined }))

import { runAutoFulfillmentBatch } from "@/lib/auto-order/engine"

beforeEach(() => {
  h.circuitFailures.length = 0
})

describe("runAutoFulfillmentBatch — circuit breaker", () => {
  it("a CANCELLED job (refused duplicate / non-purchasable order) is not a provider failure", async () => {
    h.placed = { supplierOrderId: null, status: "CANCELLED", errorMessage: "duplicate_purchase_prevented:already_placed" }
    await runAutoFulfillmentBatch("cs_1")
    expect(h.circuitFailures).toHaveLength(0)
  })

  it("a margin refusal is a decision about the sale, not a provider failure", async () => {
    h.placed = { supplierOrderId: null, status: "FAILED", errorMessage: "margin_refused:margin_below_floor" }
    await runAutoFulfillmentBatch("cs_1")
    expect(h.circuitFailures).toHaveLength(0)
  })

  it("an ordinary supplier failure still counts (unchanged)", async () => {
    h.placed = { supplierOrderId: null, status: "FAILED", errorMessage: "INVENTORY_SHORTAGE" }
    await runAutoFulfillmentBatch("cs_1")
    expect(h.circuitFailures).toEqual(["provider:prov1"])
  })
})
