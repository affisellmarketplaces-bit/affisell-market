/**
 * cancelSupplierFulfillmentJob on a job that groups several orders (#4). An AliExpress job buys only its FIRST line: its supplier
 * order id is that one order's purchase. Cancelling it on behalf of another order would cancel a valid purchase (afterpay on a
 * parcel that is on its way) and overwrite the fulfilment status of orders that were fine.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  job: null as Record<string, unknown> | null,
  cancelled: [] as string[],
  jobUpdates: [] as unknown[],
  orderUpdates: [] as Array<{ where: { id: string } }>,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierFulfillmentOrder: {
      findUnique: async () => h.job,
      update: async (a: unknown) => void h.jobUpdates.push(a),
    },
    order: { update: async (a: { where: { id: string } }) => void h.orderUpdates.push(a) },
  },
}))
vi.mock("@/lib/suppliers/place-order-bridge", () => ({
  resolveSupplierAdapterForGroup: async () => ({
    cancelOrder: async (id: string) => void h.cancelled.push(id),
  }),
}))

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"

function sharedJob(channelType: string, orders = ["order_A", "order_B"]) {
  h.job = {
    id: "job1",
    fulfillmentProviderId: "prov1",
    supplierOrderId: "X-1",
    status: "PROCESSING",
    provider: { channelType },
    lines: orders.map((orderId, i) => ({ id: `l${i + 1}`, orderId })),
  }
}

beforeEach(() => {
  h.cancelled.length = 0
  h.jobUpdates.length = 0
  h.orderUpdates.length = 0
})

describe("cancelSupplierFulfillmentJob — shared AliExpress job", () => {
  it("on behalf of the SECOND order: nothing is cancelled, nothing is overwritten (not_cancellable)", async () => {
    sharedJob("ALIEXPRESS")
    expect(await cancelSupplierFulfillmentJob("job1", { forOrderId: "order_B" })).toEqual({ ok: false, error: "not_cancellable" })
    expect(h.cancelled).toEqual([])
    expect(h.jobUpdates).toHaveLength(0)
    expect(h.orderUpdates).toHaveLength(0)
  })

  it("on behalf of the FIRST order: the AliExpress purchase is cancelled and ONLY that order is flagged", async () => {
    sharedJob("ALIEXPRESS")
    expect(await cancelSupplierFulfillmentJob("job1", { forOrderId: "order_A" })).toEqual({ ok: true })
    expect(h.cancelled).toEqual(["X-1"])
    expect(h.orderUpdates.map((u) => u.where.id)).toEqual(["order_A"])
  })

  it("by a caller that does not say which order: refused (safe default, no wrong cancellation)", async () => {
    sharedJob("ALIEXPRESS")
    expect(await cancelSupplierFulfillmentJob("job1")).toEqual({ ok: false, error: "not_cancellable" })
    expect(h.cancelled).toEqual([])
  })

  it("an explicit admin action on the job itself cancels it as before (allowSharedJob)", async () => {
    sharedJob("ALIEXPRESS")
    expect(await cancelSupplierFulfillmentJob("job1", { allowSharedJob: true })).toEqual({ ok: true })
    expect(h.cancelled).toEqual(["X-1"])
    expect(h.orderUpdates.map((u) => u.where.id)).toEqual(["order_A", "order_B"])
  })
})

describe("cancelSupplierFulfillmentJob — unchanged cases", () => {
  it("a single-line AliExpress job is cancelled whatever the caller says", async () => {
    sharedJob("ALIEXPRESS", ["order_A"])
    expect(await cancelSupplierFulfillmentJob("job1")).toEqual({ ok: true })
    expect(h.cancelled).toEqual(["X-1"])
  })

  it("a CJ job covers every line: cancelled on behalf of the second order too, all lines flagged", async () => {
    sharedJob("CJ_DROPSHIPPING")
    expect(await cancelSupplierFulfillmentJob("job1", { forOrderId: "order_B" })).toEqual({ ok: true })
    expect(h.cancelled).toEqual(["X-1"])
    expect(h.orderUpdates.map((u) => u.where.id)).toEqual(["order_A", "order_B"])
  })

  it("a shipped job is still not cancellable", async () => {
    sharedJob("CJ_DROPSHIPPING")
    ;(h.job as { status: string }).status = "SHIPPED"
    expect(await cancelSupplierFulfillmentJob("job1")).toEqual({ ok: false, error: "not_cancellable" })
  })
})
