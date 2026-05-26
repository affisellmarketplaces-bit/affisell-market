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
    partnerListingCode?: string | null
    settlement: MarketplaceOrderSettlement
    taxCents?: number | null
    totalCents?: number | null
    imageUrl?: string | null
  }
): Promise<void> {
  const imageUrl = args.imageUrl?.trim() || null
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
        supplierNetCents: args.settlement.supplierNetCents,
        supplierGrossCents: args.settlement.basePriceCents,
        affiliateCommissionCents: args.settlement.affiliateCommissionCents,
      }),
      orderId: args.orderId,
    },
  })

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
}
