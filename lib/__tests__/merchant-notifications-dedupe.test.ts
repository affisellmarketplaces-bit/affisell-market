import { describe, expect, it } from "vitest"

import { dedupeMerchantNotifications } from "@/lib/merchant-notifications-dedupe"

describe("dedupeMerchantNotifications", () => {
  it("keeps newest row per orderId and alert type", () => {
    const rows = [
      {
        id: "n1",
        type: "NEW_ORDER",
        orderId: "ord_1",
        read: false,
        createdAt: "2026-06-19T18:00:00.000Z",
      },
      {
        id: "n2",
        type: "NEW_ORDER",
        orderId: "ord_1",
        read: false,
        createdAt: "2026-06-19T17:00:00.000Z",
      },
      {
        id: "n3",
        type: "NEW_SALE",
        orderId: "ord_1",
        read: false,
        createdAt: "2026-06-19T18:00:00.000Z",
      },
    ]

    const deduped = dedupeMerchantNotifications(rows)
    expect(deduped.map((r) => r.id)).toEqual(["n1", "n3"])
  })

  it("preserves invite notifications without orderId", () => {
    const rows = [
      {
        id: "a",
        type: "SUPPLIER_INVITE_CATALOG_LIVE",
        orderId: null,
        read: false,
        createdAt: "2026-06-19T18:00:00.000Z",
      },
      {
        id: "b",
        type: "SUPPLIER_INVITE_CATALOG_LIVE",
        orderId: null,
        read: false,
        createdAt: "2026-06-19T17:00:00.000Z",
      },
    ]

    expect(dedupeMerchantNotifications(rows)).toHaveLength(2)
  })
})
