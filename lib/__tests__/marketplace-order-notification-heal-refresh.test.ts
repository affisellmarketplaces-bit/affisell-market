import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The "refresh" pass re-heals the most recent already-notified orders (≈ 15–20 queries each). It used to run on
 * every poll; it is now OFF unless an EXPLICIT catch-up asks for it (`includeRefresh: true`). The code is kept.
 */

const { notificationFindMany, orderFindMany, orderFindUnique, transaction } = vi.hoisted(() => ({
  notificationFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { findMany: notificationFindMany },
    order: { findMany: orderFindMany, findUnique: orderFindUnique },
    $transaction: transaction,
  },
}))

vi.mock("@/lib/marketplace-order-settlement-reconcile", () => ({
  reconcileMarketplaceOrderPartnerAmounts: vi.fn(async (orderId: string) => ({ reconciled: false, orderId })),
}))

vi.mock("@/lib/marketplace-order-notifications", () => ({
  createMarketplaceOrderNotifications: vi.fn(async () => ({
    supplierInboxCreated: false,
    affiliateInboxCreated: false,
    supplierInboxRefreshed: false,
    affiliateInboxRefreshed: false,
  })),
}))

import { healRecentPartnerMarketplaceNotifications } from "@/lib/marketplace-order-notification-heal"

function orderRow(id: string) {
  return {
    id,
    status: "paid",
    supplierId: "sup_1",
    affiliateId: "aff_1",
    quantity: 1,
    customerEmail: "buyer@example.com",
    variantLabel: null,
    variantImageUrl: null,
    subtotalCents: 5000,
    sellingPriceCents: 5000,
    taxCents: 0,
    totalCents: 5000,
    supplierPriceCents: 3000,
    supplierPayoutCents: 2700,
    supplierFeeCents: 300,
    commissionCents: 500,
    affiliatePayoutCents: 500,
    affiliateMarginRetainedCents: 500,
    affiliateFeeCents: 50,
    affisellFeeCents: 100,
    marginCents: 0,
    usesAffisellAutoBuy: false,
    paidAt: new Date(),
    merchantSupplierInboxNotifiedAt: new Date(),
    merchantAffiliateInboxNotifiedAt: new Date(),
    product: { name: "Stabilisateur" },
    affiliate: { store: { partnerListingCode: "AFS-ECOM" } },
    affiliateProduct: null,
  }
}

describe("healRecentPartnerMarketplaceNotifications — refresh pass is explicit", () => {
  beforeEach(() => {
    // mockReset (not clearAllMocks): a queued mockResolvedValueOnce must not leak from one test into the next.
    for (const fn of [notificationFindMany, orderFindMany, orderFindUnique, transaction]) fn.mockReset()
    notificationFindMany.mockResolvedValue([])
    // 1st findMany = "missing alerts" pass, 2nd = "refresh" pass (only when asked for).
    orderFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "ord_refresh" }])
    orderFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => orderRow(where.id))
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
  })

  it("by default does NOT select or re-heal the already-notified orders", async () => {
    const result = await healRecentPartnerMarketplaceNotifications({ supplierId: "sup_1" })

    // Only the "missing alerts" query ran: no refresh candidates were even selected.
    expect(orderFindMany).toHaveBeenCalledTimes(1)
    expect(orderFindUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
    expect(result).toEqual({ scanned: 0, healed: 0, refreshed: 0 })
  })

  it("treats includeRefresh: false exactly like the default", async () => {
    await healRecentPartnerMarketplaceNotifications({ affiliateId: "aff_1" }, { includeRefresh: false })
    expect(orderFindMany).toHaveBeenCalledTimes(1)
    expect(orderFindUnique).not.toHaveBeenCalled()
  })

  it("still heals the MISSING alerts without the refresh pass", async () => {
    orderFindMany.mockReset()
    orderFindMany.mockResolvedValueOnce([{ id: "ord_missing" }])

    const result = await healRecentPartnerMarketplaceNotifications({ supplierId: "sup_1" })

    expect(orderFindUnique).toHaveBeenCalledTimes(1)
    expect(orderFindUnique.mock.calls[0][0].where).toEqual({ id: "ord_missing" })
    expect(orderFindMany).toHaveBeenCalledTimes(1)
    expect(result.scanned).toBe(1)
  })

  it("runs the refresh pass only when explicitly requested", async () => {
    const result = await healRecentPartnerMarketplaceNotifications({ supplierId: "sup_1" }, { includeRefresh: true })

    expect(orderFindMany).toHaveBeenCalledTimes(2)
    const refreshWhere = orderFindMany.mock.calls[1][0].where
    expect(refreshWhere.merchantSupplierInboxNotifiedAt).toEqual({ not: null })
    expect(orderFindUnique).toHaveBeenCalledTimes(1)
    expect(orderFindUnique.mock.calls[0][0].where).toEqual({ id: "ord_refresh" })
    expect(result.scanned).toBe(1)
  })
})
