import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * syncAutoBuyTracking (finalisation G4): AliExpress tracking → order shipped, only when the order still awaits shipment.
 * The AliExpress lookup is injected (no network); the database is an in-memory stand-in for the three tables touched.
 */
type OrderRow = {
  id: string
  status: string
  paymentSettlementStatus: string | null
  trackingNumber: string | null
  trackingCarrier?: string | null
  fulfillmentStatus?: string | null
  trackingLockedAt?: Date | null
}
type LogRow = { id: string; orderId: string; aeOrderId: string | null; status: string; aeTracking: string | null; updatedAt: Date }

const db = vi.hoisted(() => ({
  orders: new Map<string, OrderRow>(),
  logs: [] as LogRow[],
  events: [] as Array<Record<string, unknown>>,
  alerts: [] as string[],
  released: [] as string[],
}))

vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: vi.fn(async (text: string) => {
    db.alerts.push(text)
    return { slack: false, discord: false }
  }),
}))
vi.mock("@/lib/trigger-order-transfer-release", () => ({
  triggerOrderTransferRelease: vi.fn((id: string) => db.released.push(id)),
}))
vi.mock("@/lib/order-tracking-event", () => ({
  recordOrderTrackingEvent: vi.fn(async (args: Record<string, unknown>) => {
    db.events.push(args)
    return { created: true, eventId: "e1" }
  }),
}))
vi.mock("@/lib/prisma", () => {
  const fulfillmentLog = {
    findMany: vi.fn(async () =>
      db.logs.filter((l) => l.status === "BOUGHT" && l.aeOrderId && !l.aeTracking).map((l) => ({ ...l }))
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<LogRow> }) => {
      const row = db.logs.find((l) => l.id === where.id)!
      Object.assign(row, data)
      return row
    }),
  }
  const order = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = db.orders.get(where.id)
      return row ? { ...row } : null
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { id: string; status: string }; data: Partial<OrderRow> }) => {
        const row = db.orders.get(where.id)
        if (!row || row.status !== where.status || row.trackingNumber) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      }
    ),
  }
  const tx = { fulfillmentLog, order }
  return {
    prisma: {
      ...tx,
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  }
})

import { syncAutoBuyTracking } from "@/lib/fulfillment/auto-buy"

const TRACKING = {
  ok: true as const,
  host: "test",
  tracking: { number: "LP00123456789CN", carrier: "Cainiao", source: "ds_order_tracking_get" as const, lastEvent: null },
}

function seed(order: Partial<OrderRow> & { id: string }, aeOrderId = "8180000000000001") {
  db.orders.set(order.id, { status: "paid", paymentSettlementStatus: "PAID", trackingNumber: null, ...order })
  db.logs.push({ id: `log-${order.id}`, orderId: order.id, aeOrderId, status: "BOUGHT", aeTracking: null, updatedAt: new Date() })
}

beforeEach(() => {
  db.orders.clear()
  db.logs = []
  db.events = []
  db.alerts = []
  db.released = []
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("syncAutoBuyTracking", () => {
  it("marks a paid order shipped with the AliExpress number, locks the tracking, records the event, releases payouts", async () => {
    seed({ id: "o1" })

    const results = await syncAutoBuyTracking(10, { fetchTracking: async () => TRACKING })

    expect(results).toEqual([{ fulfillmentLogId: "log-o1", updated: true, outcome: "shipped" }])
    expect(db.orders.get("o1")).toMatchObject({
      status: "shipped",
      fulfillmentStatus: "SHIPPED",
      trackingNumber: "LP00123456789CN",
      trackingCarrier: "Cainiao",
    })
    expect(db.orders.get("o1")!.trackingLockedAt).toBeInstanceOf(Date)
    expect(db.logs[0]!.aeTracking).toBe("LP00123456789CN")
    expect(db.events).toEqual([
      expect.objectContaining({ orderId: "o1", eventType: "TRACKING_REGISTERED", source: "aliexpress_ds_tracking" }),
    ])
    expect(db.released).toEqual(["o1"])
    expect(db.alerts).toEqual([])
  })

  it("does nothing yet when AliExpress has no tracking, and keeps polling that purchase", async () => {
    seed({ id: "o1" })

    const results = await syncAutoBuyTracking(10, { fetchTracking: async () => ({ ok: true, host: "t", tracking: null }) })

    expect(results[0]).toMatchObject({ updated: false, outcome: "no_tracking_yet" })
    expect(db.orders.get("o1")!.status).toBe("paid")
    expect(db.logs[0]!.aeTracking).toBeNull()
  })

  it("reports a failed lookup without touching anything", async () => {
    seed({ id: "o1" })

    const results = await syncAutoBuyTracking(10, { fetchTracking: async () => ({ ok: false, error: "token_error" }) })

    expect(results[0]).toMatchObject({ outcome: "lookup_failed", error: "token_error" })
    expect(db.orders.get("o1")!.status).toBe("paid")
  })

  it.each([
    ["refunded", "REFUNDED"],
    ["cancelled", "CANCELLED"],
    ["disputed", "PAID"],
    ["shipped", "PAID"],
  ])("never moves a %s order; stores the number on the purchase and alerts a human once", async (status, settlement) => {
    seed({ id: "o1", status, paymentSettlementStatus: settlement })

    const first = await syncAutoBuyTracking(10, { fetchTracking: async () => TRACKING })
    const second = await syncAutoBuyTracking(10, { fetchTracking: async () => TRACKING })

    expect(first[0]).toMatchObject({ updated: false, outcome: "tracking_stored_order_not_shippable" })
    expect(second).toEqual([]) // the purchase now has its number: not polled again, not alerted again
    expect(db.orders.get("o1")!.status).toBe(status)
    expect(db.orders.get("o1")!.trackingNumber).toBeNull()
    expect(db.logs[0]!.aeTracking).toBe("LP00123456789CN")
    expect(db.alerts).toHaveLength(1)
    expect(db.alerts[0]).toContain("o1")
    expect(db.released).toEqual([])
  })

  it("keeps a tracking number the supplier already entered", async () => {
    seed({ id: "o1", trackingNumber: "SUPPLIER123456" })

    const results = await syncAutoBuyTracking(10, { fetchTracking: async () => TRACKING })

    expect(results[0]).toMatchObject({ outcome: "tracking_stored_order_has_tracking" })
    expect(db.orders.get("o1")!.trackingNumber).toBe("SUPPLIER123456")
    expect(db.released).toEqual([])
    expect(db.alerts).toEqual([])
  })

  it("stops when its time budget is spent (the rest is polled at the next run)", async () => {
    seed({ id: "o1" }, "8180000000000001")
    seed({ id: "o2" }, "8180000000000002")

    const results = await syncAutoBuyTracking(10, {
      budgetMs: -1,
      fetchTracking: async () => TRACKING,
    })

    expect(results).toEqual([])
    expect(db.orders.get("o1")!.status).toBe("paid")
  })
})
