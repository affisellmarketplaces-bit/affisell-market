import { describe, expect, it, vi } from "vitest"

import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import {
  affiliateSaleNotificationSettlement,
  computeMarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"

describe("createMarketplaceOrderNotifications", () => {
  it("is idempotent per order for supplier and affiliate inbox alerts", async () => {
    const settlement = computeMarketplaceOrderSettlement({
      sellingPriceCents: 9_508,
      supplierPriceCents: 7_606,
      supplierCommissionRateBps: 1_250,
    })
    const notificationRows: Array<{ userId: string; type: string; orderId: string }> = []

    const tx = {
      order: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      notification: {
        create: vi.fn(async ({ data }: { data: { userId: string; type: string; orderId: string } }) => {
          notificationRows.push(data)
        }),
      },
    }

    const args = {
      orderId: "ord_test",
      supplierId: "sup_1",
      affiliateId: "aff_1",
      productName: "Console portable",
      variantBit: " · Bleu",
      qty: 1,
      customerEmail: "buyer@example.com",
      partnerListingCode: "AFS-TEST123",
      settlement: affiliateSaleNotificationSettlement(settlement, {
        affiliateMarginRetainedCents: 951,
        affiliatePlatformFeeCents: 95,
      }),
      supplierNetCents: 7_606,
      supplierPlatformFeeCents: 951,
      usesAffisellAutoBuy: false,
      taxCents: 0,
      totalCents: 9_508,
      imageUrl: "https://example.com/product.jpg",
    }

    const first = await createMarketplaceOrderNotifications(tx as never, args)
    const second = await createMarketplaceOrderNotifications(tx as never, args)

    expect(first).toEqual({ supplierInboxCreated: true, affiliateInboxCreated: true })
    expect(second).toEqual({ supplierInboxCreated: false, affiliateInboxCreated: false })
    expect(notificationRows).toHaveLength(2)
    expect(tx.notification.create).toHaveBeenCalledTimes(2)
  })
})
