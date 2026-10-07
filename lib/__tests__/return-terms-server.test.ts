import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  attrFindMany: vi.fn(),
  termsCreateMany: vi.fn(),
  termsFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: m.orderFindMany },
    productAttribute: { findMany: m.attrFindMany },
    orderReturnTerms: { createMany: m.termsCreateMany, findMany: m.termsFindMany },
  },
}))

import {
  loadOrderReturnWindowDays,
  loadOrderReturnWindowDaysFor,
  recordOrderReturnTerms,
} from "@/lib/return-terms.server"

const missingTable = () =>
  new Prisma.PrismaClientKnownRequestError("The table does not exist", { code: "P2021", clientVersion: "test" })

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset())
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("recordOrderReturnTerms — freezing the offered window at purchase", () => {
  it("writes a row only for products that extend the legal window, idempotently", async () => {
    m.orderFindMany.mockResolvedValue([
      { id: "o1", productId: "pA" },
      { id: "o2", productId: "pB" },
      { id: "o3", productId: "pC" },
    ])
    m.attrFindMany.mockResolvedValue([
      { productId: "pA", value: "30" },
      { productId: "pB", value: "10" }, // not an extension → nothing to freeze
      // pC has no attribute at all
    ])
    await recordOrderReturnTerms(["o1", "o2", "o3", "o1"])
    expect(m.termsCreateMany).toHaveBeenCalledTimes(1)
    expect(m.termsCreateMany).toHaveBeenCalledWith({
      data: [{ orderId: "o1", returnWindowDays: 30 }],
      skipDuplicates: true,
    })
  })

  it("only freezes orders that were just created (a replayed webhook never freezes today's terms on an old order)", async () => {
    m.orderFindMany.mockResolvedValue([])
    await recordOrderReturnTerms(["old"])
    const where = m.orderFindMany.mock.calls[0]![0].where
    expect(where.id).toEqual({ in: ["old"] })
    const gte = where.createdAt.gte as Date
    expect(Date.now() - gte.getTime()).toBeLessThanOrEqual(61 * 60 * 1000)
    expect(Date.now() - gte.getTime()).toBeGreaterThanOrEqual(59 * 60 * 1000)
    expect(m.termsCreateMany).not.toHaveBeenCalled()
  })

  it("writes nothing and asks nothing when no product extends the window", async () => {
    m.orderFindMany.mockResolvedValue([{ id: "o1", productId: "pA" }])
    m.attrFindMany.mockResolvedValue([])
    await recordOrderReturnTerms(["o1"])
    expect(m.termsCreateMany).not.toHaveBeenCalled()
    await recordOrderReturnTerms([])
    expect(m.orderFindMany).toHaveBeenCalledTimes(1)
  })

  it("NEVER throws — a missing table or any failure must not be able to touch the settled payment", async () => {
    m.orderFindMany.mockResolvedValue([{ id: "o1", productId: "pA" }])
    m.attrFindMany.mockResolvedValue([{ productId: "pA", value: "30" }])
    m.termsCreateMany.mockRejectedValue(missingTable())
    await expect(recordOrderReturnTerms(["o1"])).resolves.toBeUndefined()
    m.orderFindMany.mockRejectedValue(new Error("db down"))
    await expect(recordOrderReturnTerms(["o1"])).resolves.toBeUndefined()
  })
})

describe("loadOrderReturnWindowDays — what a buyer can return in", () => {
  it("returns the frozen window per order, never below the legal 14", async () => {
    m.termsFindMany.mockResolvedValue([
      { orderId: "o1", returnWindowDays: 60 },
      { orderId: "o2", returnWindowDays: 3 },
    ])
    const map = await loadOrderReturnWindowDays(["o1", "o2", "o3"])
    expect(map.get("o1")).toBe(60)
    expect(map.get("o2")).toBe(14)
    expect(map.has("o3")).toBe(false)
  })

  it("falls back to the legal 14 days when the terms cannot be read (table not migrated yet)", async () => {
    m.termsFindMany.mockRejectedValue(missingTable())
    expect((await loadOrderReturnWindowDays(["o1"])).size).toBe(0)
    expect(await loadOrderReturnWindowDaysFor("o1")).toBe(14)
    m.termsFindMany.mockRejectedValue(new Error("boom"))
    expect(await loadOrderReturnWindowDaysFor("o1")).toBe(14)
  })

  it("does not query for nothing", async () => {
    expect((await loadOrderReturnWindowDays([])).size).toBe(0)
    expect(m.termsFindMany).not.toHaveBeenCalled()
  })
})
