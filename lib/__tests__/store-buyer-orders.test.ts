import { beforeEach, describe, expect, it, vi } from "vitest"

const { storeFindUnique, orderFindMany } = vi.hoisted(() => ({
  storeFindUnique: vi.fn(),
  orderFindMany: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: { store: { findUnique: storeFindUnique }, order: { findMany: orderFindMany } },
}))

import { loadStoreBuyerOrders, storeBuyerOrderRef } from "@/lib/store-buyer-orders.server"

const row = {
  id: "clorder0123456789",
  createdAt: new Date("2026-03-01T10:00:00Z"),
  quantity: 2,
  sellingPriceCents: 5998,
  status: "shipped",
  supplierPreparingAt: null,
  shippedAt: new Date("2026-03-02T10:00:00Z"),
  deliveredAt: null,
  deliveryConfirmedAt: null,
  trackingCarrier: "Colissimo",
  trackingNumber: "6A123",
  variantImageUrl: null,
  product: { name: "Casque", images: ["https://cdn.example.com/p.jpg"] },
}

describe("loadStoreBuyerOrders", () => {
  beforeEach(() => {
    storeFindUnique.mockReset()
    orderFindMany.mockReset()
  })

  it("scopes the query to the store's reseller and the buyer's email/user id", async () => {
    storeFindUnique.mockResolvedValue({ userId: "aff-1" })
    orderFindMany.mockResolvedValue([])
    await loadStoreBuyerOrders({ storeSlug: "maison-lea", email: "  Buyer@Example.COM ", buyerUserId: "u-9" })

    expect(storeFindUnique.mock.calls[0]![0].where).toEqual({ slug: "maison-lea" })
    const where = orderFindMany.mock.calls[0]![0].where
    expect(where.affiliateId).toBe("aff-1")
    expect(where.OR).toEqual([
      { customerEmail: { equals: "buyer@example.com", mode: "insensitive" } },
      { buyerUserId: "u-9" },
    ])
    // Abandoned / cancelled checkouts stay hidden, like the marketplace buyer account.
    expect(where.status).toEqual({ notIn: ["PENDING", "CANCELLED", "cancelled"] })
  })

  it("returns nothing (and never queries orders) for an unknown store", async () => {
    storeFindUnique.mockResolvedValue(null)
    await expect(loadStoreBuyerOrders({ storeSlug: "ghost", email: "a@b.co" })).resolves.toEqual([])
    expect(orderFindMany).not.toHaveBeenCalled()
  })

  it("maps rows to the buyer-facing shape without supplier data", async () => {
    storeFindUnique.mockResolvedValue({ userId: "aff-1" })
    orderFindMany.mockResolvedValue([row])
    const [order] = await loadStoreBuyerOrders({ storeSlug: "maison-lea", email: "a@b.co" })
    expect(order).toEqual({
      id: "clorder0123456789",
      ref: "CLORDER0",
      createdAt: "2026-03-01T10:00:00.000Z",
      quantity: 2,
      totalCents: 5998,
      stage: "shipped",
      productName: "Casque",
      imageUrl: "https://cdn.example.com/p.jpg",
      trackingCarrier: "Colissimo",
      trackingNumber: "6A123",
      trackingUrl: "https://www.laposte.fr/outils/suivre-vos-envois?code=6A123",
    })
    expect(Object.keys(order!)).not.toContain("supplierId")
  })

  it("matches the 8-char reference used in order e-mails", () => {
    expect(storeBuyerOrderRef("clorder0123456789")).toBe("CLORDER0")
  })
})
