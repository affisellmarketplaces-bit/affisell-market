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

type InboxType = "NEW_ORDER" | "NEW_SALE"

async function upsertMerchantInboxNotification(
  tx: Tx,
  args: {
    orderId: string
    userId: string
    type: InboxType
    flag: "merchantSupplierInboxNotifiedAt" | "merchantAffiliateInboxNotifiedAt"
    data: {
      message: string
      imageUrl: string | null
    }
  }
): Promise<boolean> {
  const existing = await tx.notification.findFirst({
    where: { userId: args.userId, orderId: args.orderId, type: args.type },
    select: { id: true },
  })

  if (existing) {
    await tx.order.updateMany({
      where: { id: args.orderId, [args.flag]: null },
      data: { [args.flag]: new Date() },
    })
    return false
  }

  await tx.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      message: args.data.message,
      imageUrl: args.data.imageUrl,
      orderId: args.orderId,
    },
  })

  await tx.order.update({
    where: { id: args.orderId },
    data: { [args.flag]: new Date() },
  })

  return true
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

  const supplierInboxCreated = await upsertMerchantInboxNotification(tx, {
    orderId: args.orderId,
    userId: args.supplierId,
    type: "NEW_ORDER",
    flag: "merchantSupplierInboxNotifiedAt",
    data: {
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
    },
  })

  const affiliateInboxCreated = await upsertMerchantInboxNotification(tx, {
    orderId: args.orderId,
    userId: args.affiliateId,
    type: "NEW_SALE",
    flag: "merchantAffiliateInboxNotifiedAt",
    data: {
      imageUrl,
      message: formatAffiliateNewSaleNotification({
        productName: args.productName,
        variantBit: args.variantBit,
        qty: args.qty,
        settlement: args.settlement,
        taxCents: args.taxCents,
        totalCents: args.totalCents,
      }),
    },
  })

  const result = { supplierInboxCreated, affiliateInboxCreated }

  if (result.supplierInboxCreated || result.affiliateInboxCreated) {
    console.log("[marketplace-order-notifications]", {
      orderId: args.orderId,
      supplierInboxCreated: result.supplierInboxCreated,
      affiliateInboxCreated: result.affiliateInboxCreated,
    })
  }

  return result
}
