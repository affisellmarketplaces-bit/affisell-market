import type { Prisma } from "@prisma/client"

import {
  formatAffiliateNewSaleNotification,
  formatSupplierNewOrderNotification,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"

type Tx = Prisma.TransactionClient

export type MarketplaceOrderNotificationResult = {
  supplierInboxCreated: boolean
  affiliateInboxCreated: boolean
}

export async function createMarketplaceOrderNotifications(
  tx: Tx,
  args: {
    orderId: string
    supplierId: string
    affiliateId: string
    productName: string
    variantBit: string
    qty: number
    customerEmail: string
    partnerListingCode?: string | null
    settlement: MarketplaceOrderSettlement
    supplierNetCents: number
    supplierPlatformFeeCents: number
    usesAffisellAutoBuy: boolean
    taxCents?: number | null
    totalCents?: number | null
    imageUrl?: string | null
  }
): Promise<MarketplaceOrderNotificationResult> {
  const imageUrl = args.imageUrl?.trim() || null
  const result: MarketplaceOrderNotificationResult = {
    supplierInboxCreated: false,
    affiliateInboxCreated: false,
  }

  const supplierClaim = await tx.order.updateMany({
    where: { id: args.orderId, merchantSupplierInboxNotifiedAt: null },
    data: { merchantSupplierInboxNotifiedAt: new Date() },
  })

  if (supplierClaim.count > 0) {
    await tx.notification.create({
      data: {
        userId: args.supplierId,
        type: "NEW_ORDER",
        imageUrl,
        message: formatSupplierNewOrderNotification({
          productName: args.productName,
          variantBit: args.variantBit,
          qty: args.qty,
          customerEmail: args.customerEmail,
          partnerListingCode: args.partnerListingCode,
          supplierNetCents: args.supplierNetCents,
          supplierGrossCents: args.settlement.basePriceCents,
          affiliateCommissionCents: args.settlement.affiliateCommissionCents,
          supplierPlatformFeeCents: args.supplierPlatformFeeCents,
          usesAffisellAutoBuy: args.usesAffisellAutoBuy,
        }),
        orderId: args.orderId,
      },
    })
    result.supplierInboxCreated = true
  }

  const affiliateClaim = await tx.order.updateMany({
    where: { id: args.orderId, merchantAffiliateInboxNotifiedAt: null },
    data: { merchantAffiliateInboxNotifiedAt: new Date() },
  })

  if (affiliateClaim.count > 0) {
    await tx.notification.create({
      data: {
        userId: args.affiliateId,
        type: "NEW_SALE",
        imageUrl,
        message: formatAffiliateNewSaleNotification({
          productName: args.productName,
          variantBit: args.variantBit,
          qty: args.qty,
          settlement: args.settlement,
          taxCents: args.taxCents,
          totalCents: args.totalCents,
        }),
        orderId: args.orderId,
      },
    })
    result.affiliateInboxCreated = true
  }

  if (result.supplierInboxCreated || result.affiliateInboxCreated) {
    console.log("[marketplace-order-notifications]", {
      orderId: args.orderId,
      supplierInboxCreated: result.supplierInboxCreated,
      affiliateInboxCreated: result.affiliateInboxCreated,
    })
  }

  return result
}
