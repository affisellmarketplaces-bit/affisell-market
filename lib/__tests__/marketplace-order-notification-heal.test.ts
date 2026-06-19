import { describe, expect, it, vi, beforeEach } from "vitest"

const { findUnique, transaction } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique },
    $transaction: transaction,
  },
}))

vi.mock("@/lib/marketplace-order-notifications", () => ({
  createMarketplaceOrderNotifications: vi.fn(async () => ({
    supplierInboxCreated: true,
    affiliateInboxCreated: false,
  })),
}))

import { healMarketplaceOrderNotifications } from "@/lib/marketplace-order-notification-heal"

describe("healMarketplaceOrderNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
  })

  it("heals preparing orders missing supplier inbox rows", async () => {
    findUnique.mockResolvedValue({
      id: "ord_prep",
      status: "preparing",
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
      affiliateMarginRetainedCents: 500,
      affiliateFeeCents: 50,
      affisellFeeCents: 100,
      marginCents: 0,
      usesAffisellAutoBuy: false,
      paidAt: new Date(),
      product: { name: "Commode 6 tiroirs" },
      affiliate: { store: { partnerListingCode: "AFS-ECOM" } },
      affiliateProduct: { affiliate: { store: { partnerListingCode: "AFS-ECOM" } } },
    })

    const result = await healMarketplaceOrderNotifications("ord_prep")
    expect(result.supplierInboxCreated).toBe(true)
  })
})
