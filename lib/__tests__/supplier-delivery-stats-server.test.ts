import { beforeEach, describe, expect, it, vi } from "vitest"

const { orderFindMany, userFindMany, statsFindMany, statsFindUnique, statsUpsert } = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  userFindMany: vi.fn(),
  statsFindMany: vi.fn(),
  statsFindUnique: vi.fn(),
  statsUpsert: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: orderFindMany },
    user: { findMany: userFindMany },
    supplierDeliveryStats: { findMany: statsFindMany, findUnique: statsFindUnique, upsert: statsUpsert },
  },
}))

import {
  computeSupplierDeliveryStats,
  loadProvenSupplierDeliveryStats,
  loadProvenSupplierDeliveryStatsMany,
  refreshSupplierDeliveryStats,
  refreshSupplierDeliveryStatsBatch,
} from "@/lib/supplier-delivery-stats.server"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-03T12:00:00Z")
const paid = new Date("2026-09-01T00:00:00Z")
const delivery = (endToEndDays: number, dispatchDays = 1) => ({
  paidAt: paid,
  shippedAt: new Date(paid.getTime() + dispatchDays * DAY),
  deliveredAt: new Date(paid.getTime() + endToEndDays * DAY),
})

beforeEach(() => {
  for (const fn of [orderFindMany, userFindMany, statsFindMany, statsFindUnique, statsUpsert]) fn.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("computeSupplierDeliveryStats", () => {
  it("only reads this supplier's carrier-attested physical deliveries inside the window", async () => {
    orderFindMany.mockResolvedValue([delivery(4), delivery(6), delivery(8)])
    const stats = await computeSupplierDeliveryStats("sup-1", NOW)

    const args = orderFindMany.mock.calls[0]![0]
    expect(args.where.supplierId).toBe("sup-1")
    expect(args.where.deliveredAtSource).toBe("aftership_webhook") // not digital / booking "deliveries"
    expect(args.where.paidAt).toEqual({ not: null })
    expect(args.where.deliveredAt.gte).toEqual(new Date(NOW.getTime() - 180 * DAY))
    expect(args.take).toBe(200)
    expect(stats).toMatchObject({ sampleSize: 3, medianEndToEndDays: 6, medianDispatchDays: 1 })
  })

  it("skips rows missing a timestamp", async () => {
    orderFindMany.mockResolvedValue([delivery(5), { paidAt: null, shippedAt: null, deliveredAt: paid }])
    expect((await computeSupplierDeliveryStats("sup-1", NOW)).sampleSize).toBe(1)
  })
})

describe("refreshSupplierDeliveryStats", () => {
  it("upserts the computed figures", async () => {
    orderFindMany.mockResolvedValue([delivery(5)])
    await refreshSupplierDeliveryStats("sup-1", NOW)
    const call = statsUpsert.mock.calls[0]![0]
    expect(call.where).toEqual({ supplierId: "sup-1" })
    expect(call.create).toMatchObject({ supplierId: "sup-1", sampleSize: 1, medianEndToEndDays: 5, computedAt: NOW })
    expect(call.update).toMatchObject({ sampleSize: 1, medianEndToEndDays: 5 })
  })

  it("records an empty window as sampleSize 0 so a supplier with no deliveries is not shown stale numbers", async () => {
    orderFindMany.mockResolvedValue([])
    await refreshSupplierDeliveryStats("sup-1", NOW)
    expect(statsUpsert.mock.calls[0]![0].update).toMatchObject({
      sampleSize: 0,
      medianEndToEndDays: null,
      p90EndToEndDays: null,
    })
  })
})

describe("refreshSupplierDeliveryStatsBatch", () => {
  it("refreshes never-measured suppliers first, then the stalest", async () => {
    userFindMany.mockResolvedValue([{ id: "fresh" }, { id: "never" }, { id: "stale" }])
    statsFindMany.mockResolvedValue([
      { supplierId: "fresh", computedAt: new Date("2026-10-03T08:00:00Z") },
      { supplierId: "stale", computedAt: new Date("2026-08-01T08:00:00Z") },
    ])
    orderFindMany.mockResolvedValue([])

    const result = await refreshSupplierDeliveryStatsBatch()
    expect(orderFindMany.mock.calls.map((c) => c[0].where.supplierId)).toEqual(["never", "stale", "fresh"])
    expect(result).toEqual({ suppliers: 3, refreshed: 3, errors: 0, truncated: false })
  })

  it("stops at the time budget and reports it (the rest go first next run)", async () => {
    userFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }])
    statsFindMany.mockResolvedValue([])
    orderFindMany.mockResolvedValue([])
    let t = 0
    const result = await refreshSupplierDeliveryStatsBatch({ budgetMs: 1000, now: () => (t += 600) })
    expect(result.truncated).toBe(true)
    expect(result.refreshed).toBeLessThan(3)
  })

  it("keeps going when one supplier fails", async () => {
    userFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }])
    statsFindMany.mockResolvedValue([])
    orderFindMany.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([])
    const result = await refreshSupplierDeliveryStatsBatch()
    expect(result).toEqual({ suppliers: 2, refreshed: 1, errors: 1, truncated: false })
  })
})

describe("loading proven stats for buyers", () => {
  const row = (sampleSize: number) => ({
    supplierId: "sup-1",
    sampleSize,
    medianDispatchDays: 1.2,
    medianEndToEndDays: 5.1,
    p90EndToEndDays: 8.4,
  })

  it("returns whole-day figures once the sample is large enough", async () => {
    statsFindUnique.mockResolvedValue(row(25))
    await expect(loadProvenSupplierDeliveryStats("sup-1")).resolves.toEqual({
      sampleSize: 25,
      medianEndToEndDays: 6,
      p90EndToEndDays: 9,
      medianDispatchDays: 1,
    })
  })

  it("shows nothing for a thin sample, a missing row, no supplier, or a database error", async () => {
    statsFindUnique.mockResolvedValue(row(9))
    await expect(loadProvenSupplierDeliveryStats("sup-1")).resolves.toBeNull()
    statsFindUnique.mockResolvedValue(null)
    await expect(loadProvenSupplierDeliveryStats("sup-1")).resolves.toBeNull()
    await expect(loadProvenSupplierDeliveryStats(null)).resolves.toBeNull()
    statsFindUnique.mockRejectedValue(new Error("db down"))
    await expect(loadProvenSupplierDeliveryStats("sup-1")).resolves.toBeNull()
  })

  it("batch: only suppliers with proven stats are returned, one query", async () => {
    statsFindMany.mockResolvedValue([row(25), { ...row(3), supplierId: "thin" }])
    const map = await loadProvenSupplierDeliveryStatsMany(["sup-1", "thin", "sup-1", ""])
    expect([...map.keys()]).toEqual(["sup-1"])
    expect(statsFindMany).toHaveBeenCalledTimes(1)
    expect(statsFindMany.mock.calls[0]![0].where).toEqual({ supplierId: { in: ["sup-1", "thin"] } })
  })

  it("batch: never throws and skips the query for an empty list", async () => {
    await expect(loadProvenSupplierDeliveryStatsMany([])).resolves.toEqual(new Map())
    expect(statsFindMany).not.toHaveBeenCalled()
    statsFindMany.mockRejectedValue(new Error("db down"))
    await expect(loadProvenSupplierDeliveryStatsMany(["sup-1"])).resolves.toEqual(new Map())
  })
})
