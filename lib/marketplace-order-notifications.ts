import type { Prisma } from "@prisma/client"

import {
  formatAffiliateNewSaleNotification,
  formatSupplierNewOrderNotification,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"

type Tx = Prisma.TransactionClient

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
    affiliateStoreName?: string | null
    settlement: MarketplaceOrderSettlement
  }
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: args.supplierId,
      type: "NEW_ORDER",
      message: formatSupplierNewOrderNotification({
        productName: args.productName,
        variantBit: args.variantBit,
        qty: args.qty,
        customerEmail: args.customerEmail,
        storeName: args.affiliateStoreName,
        settlement: args.settlement,
      }),
      orderId: args.orderId,
    },
  })

  await tx.notification.create({
    data: {
      userId: args.affiliateId,
      type: "NEW_SALE",
      message: formatAffiliateNewSaleNotification({
        productName: args.productName,
        variantBit: args.variantBit,
        qty: args.qty,
        settlement: args.settlement,
      }),
      orderId: args.orderId,
    },
  })
}
