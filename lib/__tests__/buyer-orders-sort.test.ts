import { describe, expect, it } from "vitest"

import {
  buyerOrderActionPriority,
  defaultBuyerOrdersSort,
  sortBuyerOrderRows,
} from "@/lib/buyer-orders-sort"

const rows = [
  {
    id: "old",
    createdAt: "2026-05-16T01:40:00.000Z",
    sellingPriceCents: 2_500,
    canConfirmDelivery: false,
    canCancelBooking: false,
    activeReturn: null,
    status: "shipped",
  },
  {
    id: "new",
    createdAt: "2026-06-30T10:00:00.000Z",
    sellingPriceCents: 9_900,
    canConfirmDelivery: false,
    canCancelBooking: false,
    activeReturn: null,
    status: "paid",
  },
  {
    id: "confirm",
    createdAt: "2026-06-01T08:00:00.000Z",
    sellingPriceCents: 4_500,
    canConfirmDelivery: true,
    canCancelBooking: false,
    activeReturn: null,
    status: "shipped",
  },
  {
    id: "return",
    createdAt: "2026-06-10T12:00:00.000Z",
    sellingPriceCents: 1_200,
    canConfirmDelivery: false,
    canCancelBooking: false,
    activeReturn: { status: "AWAITING_SHIPMENT" },
    status: "shipped",
  },
]

describe("sortBuyerOrderRows", () => {
  it("sorts newest first by date", () => {
    const sorted = sortBuyerOrderRows(rows, "date_desc")
    expect(sorted.map((r) => r.id)).toEqual(["new", "return", "confirm", "old"])
  })

  it("sorts oldest first by date", () => {
    const sorted = sortBuyerOrderRows(rows, "date_asc")
    expect(sorted.map((r) => r.id)).toEqual(["old", "confirm", "return", "new"])
  })

  it("sorts by amount descending", () => {
    const sorted = sortBuyerOrderRows(rows, "amount_desc")
    expect(sorted.map((r) => r.id)).toEqual(["new", "confirm", "old", "return"])
  })

  it("prioritizes action-needed orders first", () => {
    const sorted = sortBuyerOrderRows(rows, "action_needed")
    expect(sorted[0]?.id).toBe("confirm")
    expect(sorted[1]?.id).toBe("return")
  })
})

describe("buyerOrderActionPriority", () => {
  it("ranks confirm delivery above return ship-back", () => {
    expect(buyerOrderActionPriority(rows[2]!)).toBeGreaterThan(buyerOrderActionPriority(rows[3]!))
  })
})

describe("defaultBuyerOrdersSort", () => {
  it("defaults to action_needed", () => {
    expect(defaultBuyerOrdersSort()).toBe("action_needed")
  })
})
