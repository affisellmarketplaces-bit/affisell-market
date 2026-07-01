import { describe, expect, it } from "vitest"

import {
  buildMedusaShipmentLabels,
  isMedusaOrderFullyShipped,
  medusaShipmentAlreadyRecorded,
  pendingMedusaFulfillmentItems,
} from "@/lib/medusa/sync-order-fulfillment.impl"

describe("pendingMedusaFulfillmentItems", () => {
  it("returns remaining quantity per line item", () => {
    expect(
      pendingMedusaFulfillmentItems([
        { id: "orli_1", quantity: 2, detail: { fulfilled_quantity: 1 } },
        { id: "orli_2", quantity: 1, detail: { shipped_quantity: 1 } },
      ])
    ).toEqual([{ id: "orli_1", quantity: 1 }])
  })
})

describe("isMedusaOrderFullyShipped", () => {
  it("detects shipped fulfillment status", () => {
    expect(isMedusaOrderFullyShipped({ id: "order_1", fulfillment_status: "shipped" })).toBe(true)
  })

  it("detects shipped fulfillments", () => {
    expect(
      isMedusaOrderFullyShipped({
        id: "order_1",
        fulfillments: [{ id: "ful_1", shipped_at: "2026-06-01T00:00:00.000Z" }],
      })
    ).toBe(true)
  })
})

describe("medusaShipmentAlreadyRecorded", () => {
  it("matches tracking on fulfillment labels", () => {
    expect(
      medusaShipmentAlreadyRecorded(
        {
          id: "order_1",
          fulfillments: [{ id: "ful_1", labels: [{ tracking_number: "ABC123" }] }],
        },
        "ABC123"
      )
    ).toBe(true)
  })
})

describe("buildMedusaShipmentLabels", () => {
  it("uses carrier tracking URL when known", () => {
    const labels = buildMedusaShipmentLabels("1234567890", "Colissimo")
    expect(labels[0]?.tracking_number).toBe("1234567890")
    expect(labels[0]?.tracking_url).toContain("laposte.fr")
  })
})
