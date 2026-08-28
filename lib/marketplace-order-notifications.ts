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
  supplierInboxRefreshed: boolean
  affiliateInboxRefreshed: boolean
}

type InboxType = "NEW_ORDER" | "NEW_SALE"

export type UpsertMerchantInboxNotificationResult = {
  created: boolean
  refreshed: boolean
}

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
): Promise<UpsertMerchantInboxNotificationResult> {
  const existing = await tx.notification.findFirst({
    where: { userId: args.userId, orderId: args.orderId, type: args.type },
    select: { id: true, message: true },
  })

  if (existing) {
    const messageChanged = existing.message !== args.data.message
    if (messageChanged) {
      await tx.notification.update({
        where: { id: existing.id },
        data: {
          message: args.data.message,
          ...(args.data.imageUrl ? { imageUrl: args.data.imageUrl } : {}),
        },
      })
      console.log("[marketplace-order-notifications]", {
        orderId: args.orderId,
        type: args.type,
        result: "message_refreshed",
      })
    }

    await tx.order.updateMany({
      where: { id: args.orderId, [args.flag]: null },
      data: { [args.flag]: new Date() },
    })
    return { created: false, refreshed: messageChanged }
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

  return { created: true, refreshed: false }
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

  const supplierInbox = await upsertMerchantInboxNotification(tx, {
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

  const affiliateInbox = await upsertMerchantInboxNotification(tx, {
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

  const result = {
    supplierInboxCreated: supplierInbox.created,
    affiliateInboxCreated: affiliateInbox.created,
    supplierInboxRefreshed: supplierInbox.refreshed,
    affiliateInboxRefreshed: affiliateInbox.refreshed,
  }

  if (
    result.supplierInboxCreated ||
    result.affiliateInboxCreated ||
    result.supplierInboxRefreshed ||
    result.affiliateInboxRefreshed
  ) {
    console.log("[marketplace-order-notifications]", {
      orderId: args.orderId,
      ...result,
    })
  }

  return result
}
