import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const findMany = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany } } }))

import { collectSupplierRetailLeaks } from "@/lib/supplier-retail-veil"
import { loadNotificationOrderSummaries } from "@/lib/merchant-notification-order-summary"

const row = {
  id: "order_abcdef123456",
  quantity: 2,
  variantLabel: null,
  variantImageUrl: null,
  status: "paid",
  totalCents: 77745,
  sellingPriceCents: 38872,
  product: { name: "Laptop", images: ["https://cdn.example/a.jpg", "data:image/png;base64,xxx"] },
}

describe("loadNotificationOrderSummaries — resale price stays private", () => {
  it("never exposes the buyer-paid amount to a supplier, and scopes to supplierId", async () => {
    findMany.mockResolvedValueOnce([row])
    const out = await loadNotificationOrderSummaries("sup1", [row.id], "SUPPLIER")
    expect(out.get(row.id)).not.toHaveProperty("totalCents")
    expect(collectSupplierRetailLeaks([...out.values()])).toEqual([])
    expect(findMany.mock.calls[0][0].where).toMatchObject({ supplierId: "sup1" })
    expect(findMany.mock.calls[0][0].where.affiliateId).toBeUndefined()
  })

  it("gives the affiliate their own order's amount, scoped to affiliateId", async () => {
    findMany.mockResolvedValueOnce([row])
    const out = await loadNotificationOrderSummaries("aff1", [row.id], "AFFILIATE")
    expect(out.get(row.id)?.totalCents).toBe(77745)
    expect(findMany.mock.calls[1][0].where).toMatchObject({ affiliateId: "aff1" })
  })

  it("uses a real product image, never an inline base64 one", async () => {
    findMany.mockResolvedValueOnce([row])
    const out = await loadNotificationOrderSummaries("sup1", [row.id], "SUPPLIER")
    expect(out.get(row.id)?.imageUrl).toBe("https://cdn.example/a.jpg")
  })
})
