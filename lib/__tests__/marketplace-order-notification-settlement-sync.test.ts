import { describe, expect, it, vi, beforeEach } from "vitest"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  affiliateNotificationSettlementFromOrder,
  buildMarketplaceOrderNotificationArgs,
} from "@/lib/marketplace-order-notification-heal"
import { formatAffiliateNewSaleNotification } from "@/lib/marketplace-order-settlement"
import { parseAffiliateSaleNotification } from "@/lib/merchant-notification-display"
import { resolveOrderAffiliateCommissionCents } from "@/lib/marketplace-phase1-fees"
import { resolveLineAffiliateFixedMarginCents } from "@/lib/affiliate-variant-pricing"

describe("affiliate sale notification settlement sync", () => {
  it("prefers affiliatePayoutCents over legacy commissionCents on order row", () => {
    expect(
      resolveOrderAffiliateCommissionCents({
        affiliatePayoutCents: 850,
        commissionCents: 1_200,
      })
    ).toBe(850)
    expect(
      resolveOrderAffiliateCommissionCents({
        affiliatePayoutCents: 0,
        commissionCents: 1_200,
      })
    ).toBe(1_200)
  })

  it("builds settlement from persisted order amounts (HT €21.29 example)", () => {
    const settlement = affiliateNotificationSettlementFromOrder({
      subtotalCents: 2_129,
      sellingPriceCents: 2_129,
      totalCents: 2_555,
      supplierPriceCents: 1_600,
      basePriceCents: 1_600,
      marginCents: 529,
      affisellFeeCents: 350,
      commissionCents: 240,
      affiliatePayoutCents: 240,
      affiliateMarginRetainedCents: 289,
      affiliateFeeCents: 106,
      supplierPayoutCents: 1_200,
    })

    expect(settlement.affisellFeeBaseCents).toBe(2_129)
    expect(settlement.affiliateCommissionCents).toBe(240)
    expect(settlement.affiliateMarginRetainedCents).toBe(289)
    expect(settlement.affiliatePlatformFeeCents).toBe(106)

    const message = formatAffiliateNewSaleNotification({
      productName: "Kit Tente",
      variantBit: "",
      qty: 1,
      settlement,
      taxCents: 426,
      totalCents: 2_555,
    })

    const parsed = parseAffiliateSaleNotification(message)
    expect(parsed?.primaryAmount).toBe(formatStoreCurrencyFromCents(423))
    expect(parsed?.breakdown?.commission).toBe(formatStoreCurrencyFromCents(240))
    expect(parsed?.breakdown?.markup).toBe(formatStoreCurrencyFromCents(289))
    expect(parsed?.breakdown?.lineHt).toBeUndefined()
    expect(parsed?.breakdown?.clientHt).toBe(formatStoreCurrencyFromCents(2_129))
  })

  it("uses per-variant margin when listing.marginCents is zero", () => {
    const fixed = resolveLineAffiliateFixedMarginCents({
      listingMarginCents: 0,
      qty: 1,
      optionName: "Bleu",
      variantPricing: {
        Bleu: { sellingPriceCents: 5_500, marginCents: 900 },
      },
    })
    expect(fixed).toBe(900)
  })
})

describe("buildMarketplaceOrderNotificationArgs", () => {
  it("formats affiliate inbox copy from order row", () => {
    const args = buildMarketplaceOrderNotificationArgs({
      id: "ord_1",
      status: "paid",
      supplierId: "sup_1",
      affiliateId: "aff_1",
      quantity: 1,
      customerEmail: "buyer@test.com",
      variantLabel: null,
      variantImageUrl: null,
      subtotalCents: 10_000,
      sellingPriceCents: 10_000,
      taxCents: 0,
      totalCents: 10_000,
      supplierPriceCents: 6_000,
      basePriceCents: 6_000,
      supplierPayoutCents: 5_100,
      supplierFeeCents: 600,
      commissionCents: 900,
      affiliatePayoutCents: 900,
      affiliateMarginRetainedCents: 2_500,
      affiliateFeeCents: 680,
      affisellFeeCents: 1_280,
      marginCents: 4_000,
      affiliateMarginCents: 0,
      usesAffisellAutoBuy: false,
      paidAt: new Date(),
      merchantSupplierInboxNotifiedAt: null,
      merchantAffiliateInboxNotifiedAt: null,
      product: { name: "Widget" },
      affiliate: { store: { partnerListingCode: null } },
      affiliateProduct: { affiliate: { store: { partnerListingCode: null } } },
    })

    const msg = formatAffiliateNewSaleNotification({
      productName: args.productName,
      variantBit: args.variantBit,
      qty: args.qty,
      settlement: args.settlement,
      taxCents: args.taxCents,
      totalCents: args.totalCents,
    })
    const parsed = parseAffiliateSaleNotification(msg)
    expect(parsed?.breakdown?.commission).toBe(formatStoreCurrencyFromCents(900))
    expect(parsed?.breakdown?.markup).toBe(formatStoreCurrencyFromCents(2_500))
  })
})

describe("createMarketplaceOrderNotifications refresh", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("updates stale affiliate notification message on replay", async () => {
    const { createMarketplaceOrderNotifications } = await import(
      "@/lib/marketplace-order-notifications"
    )
    const { computeMarketplaceOrderSettlement, affiliateSaleNotificationSettlement } =
      await import("@/lib/marketplace-order-settlement")

    const settlement = affiliateSaleNotificationSettlement(
      computeMarketplaceOrderSettlement({
        sellingPriceCents: 2_129,
        supplierPriceCents: 1_600,
        supplierCommissionRateBps: 1_500,
        affisellFeeBaseCents: 2_129,
      }),
      {
        affiliateMarginRetainedCents: 289,
        affiliatePlatformFeeCents: 106,
        affiliateCommissionCents: 240,
      }
    )

    const staleMessage = formatAffiliateNewSaleNotification({
      productName: "Kit Tente",
      variantBit: "",
      qty: 1,
      settlement: affiliateSaleNotificationSettlement(settlement, {
        affiliateMarginRetainedCents: 0,
        affiliatePlatformFeeCents: 0,
        affiliateCommissionCents: 0,
      }),
    })

    const freshMessage = formatAffiliateNewSaleNotification({
      productName: "Kit Tente",
      variantBit: "",
      qty: 1,
      settlement,
    })

    expect(staleMessage).not.toBe(freshMessage)

    const update = vi.fn(async () => undefined)
    const tx = {
      notification: {
        findFirst: vi.fn(async () => ({ id: "notif_1", message: staleMessage })),
        create: vi.fn(async () => undefined),
        update,
      },
      order: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        update: vi.fn(async () => ({})),
      },
    }

    const result = await createMarketplaceOrderNotifications(tx as never, {
      orderId: "ord_stale",
      supplierId: "sup_1",
      affiliateId: "aff_1",
      productName: "Kit Tente",
      variantBit: "",
      qty: 1,
      customerEmail: "buyer@test.com",
      settlement,
      supplierNetCents: 1_200,
      supplierPlatformFeeCents: 200,
      usesAffisellAutoBuy: false,
    })

    expect(result.affiliateInboxRefreshed).toBe(true)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif_1" },
        data: expect.objectContaining({ message: freshMessage }),
      })
    )
  })
})
