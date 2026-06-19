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
    const existingKeys = new Set<string>()

    const tx = {
      notification: {
        findFirst: vi.fn(async ({ where }: { where: { userId: string; orderId: string; type: string } }) => {
          const key = `${where.userId}:${where.orderId}:${where.type}`
          return existingKeys.has(key) ? { id: "existing" } : null
        }),
        create: vi.fn(async ({ data }: { data: { userId: string; type: string; orderId: string } }) => {
          notificationRows.push(data)
          existingKeys.add(`${data.userId}:${data.orderId}:${data.type}`)
        }),
      },
      order: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: vi.fn(async () => ({})),
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

  it("creates supplier inbox when flag was set but notification row is missing", async () => {
    const settlement = computeMarketplaceOrderSettlement({
      sellingPriceCents: 5_000,
      supplierPriceCents: 3_000,
      supplierCommissionRateBps: 1_000,
    })

    const tx = {
      notification: {
        findFirst: vi.fn(async ({ where }: { where: { type: string } }) =>
          where.type === "NEW_SALE" ? { id: "aff_existing" } : null
        ),
        create: vi.fn(async () => undefined),
      },
      order: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        update: vi.fn(async () => ({})),
      },
    }

    const result = await createMarketplaceOrderNotifications(tx as never, {
      orderId: "ord_heal",
      supplierId: "sup_1",
      affiliateId: "aff_1",
      productName: "Commode 6 tiroirs",
      variantBit: "",
      qty: 1,
      customerEmail: "buyer@example.com",
      settlement: affiliateSaleNotificationSettlement(settlement, {
        affiliateMarginRetainedCents: 500,
        affiliatePlatformFeeCents: 50,
      }),
      supplierNetCents: 2_700,
      supplierPlatformFeeCents: 300,
      usesAffisellAutoBuy: false,
    })

    expect(result).toEqual({ supplierInboxCreated: true, affiliateInboxCreated: false })
    expect(tx.notification.create).toHaveBeenCalledOnce()
  })
})
