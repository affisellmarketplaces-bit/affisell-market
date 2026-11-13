/**
 * `applySupplierPlaceOrderResult` — how the engine records what the per-order purchase gate decided.
 * A job the gate turned away (CANCELLED) must never write onto the ORDERS: the path that really bought has just recorded
 * ORDERED there, and a refused duplicate says nothing about the provider's health.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  jobUpdates: [] as unknown[],
  orderUpdates: [] as unknown[],
  circuit: { success: [] as string[], failure: [] as string[] },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierFulfillmentOrder: { update: async (a: unknown) => void h.jobUpdates.push(a) },
    order: { update: async (a: unknown) => void h.orderUpdates.push(a) },
  },
}))
vi.mock("@/lib/auto-order/circuit-breaker", () => ({
  recordCircuitSuccess: (k: string) => void h.circuit.success.push(k),
  recordCircuitFailure: (k: string) => void h.circuit.failure.push(k),
}))

import { applySupplierPlaceOrderResult } from "@/lib/auto-order/apply-place-result"
import type { PlaceSupplierOrderResult, SupplierGroup } from "@/lib/auto-order/types"

const group = {
  providerId: "prov1",
  lines: [{ orderId: "o1" }, { orderId: "o2" }],
} as unknown as SupplierGroup

const apply = (placed: PlaceSupplierOrderResult) =>
  applySupplierPlaceOrderResult({ supplierFulfillmentOrderId: "job1", batchId: "b1", providerId: "prov1", group, placed })

beforeEach(() => {
  h.jobUpdates.length = 0
  h.orderUpdates.length = 0
  h.circuit.success.length = 0
  h.circuit.failure.length = 0
})

describe("applySupplierPlaceOrderResult", () => {
  it("CANCELLED (duplicate prevented): the job is recorded, the ORDERS are not touched, the circuit is not fed", async () => {
    const out = await apply({ supplierOrderId: null, status: "CANCELLED", errorMessage: "duplicate_purchase_prevented:already_placed" })
    expect(h.jobUpdates).toHaveLength(1)
    expect(h.jobUpdates[0]).toMatchObject({ data: { status: "CANCELLED", supplierOrderId: null } })
    expect(h.orderUpdates).toHaveLength(0)
    expect(h.circuit.success).toHaveLength(0)
    expect(h.circuit.failure).toHaveLength(0)
    expect(out.success).toBe(false)
  })

  it("FAILED `margin_refused` is a decision about the sale, not a provider failure: orders flagged, circuit untouched", async () => {
    await apply({ supplierOrderId: null, status: "FAILED", errorMessage: "margin_refused:margin_below_floor" })
    expect(h.orderUpdates).toHaveLength(2)
    expect(h.orderUpdates[0]).toMatchObject({ data: { fulfillmentStatus: "MANUAL_REQUIRED" } })
    expect(h.circuit.failure).toHaveLength(0)
  })

  it("an ordinary FAILED still counts against the circuit (unchanged)", async () => {
    await apply({ supplierOrderId: null, status: "FAILED", errorMessage: "INVENTORY_SHORTAGE" })
    expect(h.circuit.failure).toEqual(["provider:prov1"])
  })

  it("PROCESSING with a supplier order id marks the lines PROCESSING and does not feed the circuit (unchanged)", async () => {
    await apply({ supplierOrderId: "AE-1", status: "PROCESSING" })
    expect(h.orderUpdates[0]).toMatchObject({ data: { fulfillmentStatus: "PROCESSING" } })
    expect(h.circuit.failure).toHaveLength(0)
  })
})
