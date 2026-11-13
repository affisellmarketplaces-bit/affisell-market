import { describe, expect, it } from "vitest"

import {
  decideSupplierPurchase,
  PURCHASE_IN_DOUBT_AFTER_MS,
  PURCHASABLE_ORDER_STATUSES,
  type PurchaseSnapshot,
} from "@/lib/fulfillment/supplier-purchase-decision"

const NOW = new Date("2026-11-13T12:00:00Z")
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

function snap(over: Partial<PurchaseSnapshot> = {}): PurchaseSnapshot {
  return { orderId: "o1", status: "paid", supplierOrderId: null, log: null, jobs: [], ...over }
}
const log = (status: "PENDING" | "BUYING" | "BOUGHT" | "FAILED" | "REFUNDED", extra: Record<string, unknown> = {}) => ({
  status,
  aeOrderId: null,
  attempts: 0,
  updatedAt: minutesAgo(1),
  ...extra,
})

describe("decideSupplierPurchase — evidence of a purchase wins", () => {
  it("Order.supplierOrderId set => already placed (even on a refunded order, even with a BUYING log)", () => {
    for (const status of ["paid", "fulfilling", "refunded", "cancelled"]) {
      const d = decideSupplierPurchase(snap({ status, supplierOrderId: "AE123", log: log("BUYING") }), NOW)
      expect(d).toEqual({ kind: "already_placed", supplierOrderId: "AE123", evidence: "order" })
    }
  })

  it("a blank / whitespace supplierOrderId is NOT evidence", () => {
    expect(decideSupplierPurchase(snap({ supplierOrderId: "   " }), NOW).kind).toBe("claim")
    expect(decideSupplierPurchase(snap({ supplierOrderId: "" }), NOW).kind).toBe("claim")
  })

  it("a BOUGHT log => already placed, with its AliExpress id (or 'unknown' when the id was never stored)", () => {
    expect(decideSupplierPurchase(snap({ log: log("BOUGHT", { aeOrderId: "AE9" }) }), NOW)).toEqual({
      kind: "already_placed",
      supplierOrderId: "AE9",
      evidence: "log",
    })
    expect(decideSupplierPurchase(snap({ log: log("BOUGHT") }), NOW)).toMatchObject({ supplierOrderId: "unknown" })
  })

  it("an engine job carrying a supplier order id => already placed, unless FAILED / CANCELLED", () => {
    const withJob = (status: string, supplierOrderId: string | null) =>
      decideSupplierPurchase(
        snap({ jobs: [{ id: "j1", supplierOrderId, status: status as never, firstLineOrderId: "o1" }] }),
        NOW
      )
    expect(withJob("PROCESSING", "AE77")).toEqual({ kind: "already_placed", supplierOrderId: "AE77", evidence: "job" })
    expect(withJob("CONFIRMED", "AE77").kind).toBe("already_placed")
    expect(withJob("SHIPPED", "AE77").kind).toBe("already_placed")
    expect(withJob("FAILED", "AE77").kind).toBe("claim")
    expect(withJob("CANCELLED", "AE77").kind).toBe("claim")
    // a job that has no supplier order id yet is NOT evidence (the engine creates it PROCESSING before it buys)
    expect(withJob("PROCESSING", null).kind).toBe("claim")
  })

  it("a job's supplier order id proves a purchase for its FIRST line only — the group's other orders stay purchasable", () => {
    // The engine groups every AliExpress order of a cart into ONE job; the adapter buys only the first line.
    const job = (firstLineOrderId: string | null) => ({
      id: "j1",
      supplierOrderId: "AE-A",
      status: "PROCESSING" as const,
      firstLineOrderId,
    })
    expect(decideSupplierPurchase(snap({ orderId: "o1", jobs: [job("o1")] }), NOW)).toMatchObject({
      kind: "already_placed",
      supplierOrderId: "AE-A",
      evidence: "job",
    })
    // order o2 is in the same job but was never bought: NOT "already placed", never stamped with AE-A
    expect(decideSupplierPurchase(snap({ orderId: "o2", jobs: [job("o1")] }), NOW)).toEqual({ kind: "claim", attempt: 1 })
    // unknown first line (no line rows readable): fail closed against a double purchase
    expect(decideSupplierPurchase(snap({ orderId: "o2", jobs: [job(null)] }), NOW).kind).toBe("already_placed")
  })
})

describe("decideSupplierPurchase — may we still buy for this order?", () => {
  it.each(PURCHASABLE_ORDER_STATUSES)("%s is purchasable", (status) => {
    expect(decideSupplierPurchase(snap({ status }), NOW).kind).toBe("claim")
  })

  it.each(["refunded", "cancelled", "PENDING", "shipped", "delivered", "disputed"])("%s is not", (status) => {
    expect(decideSupplierPurchase(snap({ status }), NOW)).toEqual({
      kind: "not_purchasable",
      orderStatus: status,
      reason: "order_status",
    })
  })

  it("a REFUNDED log is not purchasable", () => {
    expect(decideSupplierPurchase(snap({ log: log("REFUNDED") }), NOW)).toMatchObject({
      kind: "not_purchasable",
      reason: "refunded",
    })
  })
})

describe("decideSupplierPurchase — a BUYING claim never expires into a new purchase", () => {
  it("fresh claim => in progress, not stale", () => {
    expect(decideSupplierPurchase(snap({ log: log("BUYING", { updatedAt: minutesAgo(2) }) }), NOW)).toMatchObject({
      kind: "in_progress",
      stale: false,
    })
  })

  it("old claim => STILL in progress (never a claim), flagged stale so a human is alerted", () => {
    for (const age of [16, 60, 60 * 24, 60 * 24 * 30]) {
      expect(decideSupplierPurchase(snap({ log: log("BUYING", { updatedAt: minutesAgo(age) }) }), NOW)).toMatchObject({
        kind: "in_progress",
        stale: true,
      })
    }
    expect(PURCHASE_IN_DOUBT_AFTER_MS).toBe(15 * 60 * 1000)
  })

  it("stale threshold is exclusive at exactly 15 minutes", () => {
    expect(decideSupplierPurchase(snap({ log: log("BUYING", { updatedAt: minutesAgo(15) }) }), NOW)).toMatchObject({
      stale: false,
    })
  })
})

describe("decideSupplierPurchase — what is claimable", () => {
  it("no log yet => attempt 1", () => {
    expect(decideSupplierPurchase(snap(), NOW)).toEqual({ kind: "claim", attempt: 1 })
  })

  it("PENDING => attempt = attempts + 1", () => {
    expect(decideSupplierPurchase(snap({ log: log("PENDING", { attempts: 0 }) }), NOW)).toEqual({ kind: "claim", attempt: 1 })
  })

  it("FAILED (a DEFINITIVE failure) => claimable again, attempt counts up", () => {
    expect(decideSupplierPurchase(snap({ log: log("FAILED", { attempts: 2 }) }), NOW)).toEqual({ kind: "claim", attempt: 3 })
  })
})
