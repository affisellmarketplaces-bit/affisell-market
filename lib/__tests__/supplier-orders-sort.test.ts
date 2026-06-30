import { describe, expect, it } from "vitest"

import {
  defaultSupplierOrdersSort,
  sortSupplierOrderRows,
} from "@/lib/supplier-orders-sort"

const rows = [
  {
    id: "old",
    createdAt: "2026-05-16T01:40:00.000Z",
    shipPulse: { msRemaining: 86_400_000, deadlineAt: "", phase: "safe" as const },
  },
  {
    id: "new",
    createdAt: "2026-06-30T10:00:00.000Z",
    shipPulse: { msRemaining: 86_400_000, deadlineAt: "", phase: "safe" as const },
  },
  {
    id: "late",
    createdAt: "2026-06-01T08:00:00.000Z",
    shipPulse: { msRemaining: -1, deadlineAt: "", phase: "breached" as const },
  },
]

describe("sortSupplierOrderRows", () => {
  it("sorts newest first by date", () => {
    const sorted = sortSupplierOrderRows(rows, { tab: "shipped", sort: "date_desc" })
    expect(sorted.map((r) => r.id)).toEqual(["new", "late", "old"])
  })

  it("sorts oldest first by date", () => {
    const sorted = sortSupplierOrderRows(rows, { tab: "all", sort: "date_asc" })
    expect(sorted.map((r) => r.id)).toEqual(["old", "late", "new"])
  })

  it("prioritizes breached deadlines on to_ship urgency sort", () => {
    const sorted = sortSupplierOrderRows(rows, { tab: "to_ship", sort: "urgency" })
    expect(sorted[0]?.id).toBe("late")
  })
})

describe("defaultSupplierOrdersSort", () => {
  it("uses urgency on to_ship and date_desc elsewhere", () => {
    expect(defaultSupplierOrdersSort("to_ship")).toBe("urgency")
    expect(defaultSupplierOrdersSort("shipped")).toBe("date_desc")
    expect(defaultSupplierOrdersSort("all")).toBe("date_desc")
  })
})
