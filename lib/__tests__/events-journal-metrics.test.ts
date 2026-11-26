import { describe, expect, it, vi } from "vitest"

const groupBy = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({ prisma: { affisellTrackEvent: { groupBy } } }))

import { loadProductRefundRates } from "@/lib/events/journal-metrics.server"

describe("measured refund rates for the net-margin guard", () => {
  it("smooths journal counts per product and keeps the default without data", async () => {
    groupBy.mockResolvedValueOnce([
      { productId: "prod_aaaaaa", eventType: "purchase", _count: { _all: 200 } },
      { productId: "prod_aaaaaa", eventType: "refund", _count: { _all: 60 } },
      { productId: "prod_bbbbbb", eventType: "purchase", _count: { _all: 3 } },
    ])
    const rates = await loadProductRefundRates(["prod_aaaaaa", "prod_bbbbbb", "prod_cccccc"])
    expect(rates.get("prod_aaaaaa")).toBeCloseTo((60 + 20 * 0.1) / (200 + 20), 6)
    expect(rates.get("prod_bbbbbb")).toBeCloseTo((0 + 2) / 23, 6)
    expect(rates.get("prod_cccccc")).toBe(0.1)
  })

  it("never throws: journal unavailable -> default for every product", async () => {
    groupBy.mockRejectedValueOnce(new Error("relation does not exist"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const rates = await loadProductRefundRates(["prod_aaaaaa"])
    expect(rates.get("prod_aaaaaa")).toBe(0.1)
    expect(warn).toHaveBeenCalled()
  })
})
