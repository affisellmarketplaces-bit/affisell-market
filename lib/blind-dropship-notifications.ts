import {
  formatAffiliateNewSaleNotification,
  formatSupplierNewOrderNotification,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import { aggregateBlindLinesForSupplier } from "@/lib/blind-dropship-settlement"
import { prisma } from "@/lib/prisma"

/**
 * After blind dropship payment: notify each external supplier (linked Affisell user) and the affiliate.
 */
export async function createBlindDropshipPaidNotifications(orderId: string): Promise<void> {
  const order = await prisma.blindDropshipOrder.findUnique({
    where: { id: orderId },
    include: {
      affiliate: { select: { store: { select: { name: true } } } },
      items: {
        include: {
          product: { select: { name: true } },
          blindDropshipSupplier: { select: { id: true, linkedUserId: true, name: true } },
        },
      },
    },
  })
  if (!order) return

  const lineMeta = order.items.map((it) => ({
    blindDropshipSupplierId: it.blindDropshipSupplierId,
    productName: it.product.name,
    qty: it.quantity,
    settlement: {
      sellingPriceCents: it.linePaidCents,
      basePriceCents: it.supplierPriceAtOrderCents * it.quantity,
      marginCents: it.marginCents,
      affisellFeeCents: it.affisellFeeCents,
      affiliateCommissionCents: it.affiliateCommissionCents,
      affiliateMarginRetainedCents: it.affiliateMarginRetainedCents,
      supplierNetCents: it.supplierPriceAtOrderCents * it.quantity,
    } satisfies MarketplaceOrderSettlement,
  }))

  const orderSettlement: MarketplaceOrderSettlement = {
    sellingPriceCents: order.totalPaidCents,
    basePriceCents: order.totalCostCents,
    marginCents: order.marginCents,
    affisellFeeCents: order.affisellFeeCents,
    affiliateCommissionCents: order.affiliateCommissionCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    supplierNetCents: order.totalCostCents,
  }

  const productSummary =
    lineMeta.length === 1
      ? `${lineMeta[0]!.productName} ×${lineMeta[0]!.qty}`
      : `${lineMeta.length} lines`

  await prisma.$transaction(async (tx) => {
    await tx.notification.create({
      data: {
        userId: order.affiliateId,
        type: "NEW_SALE",
        message: formatAffiliateNewSaleNotification({
          productName: productSummary,
          variantBit: " · blind dropship",
          qty: 1,
          settlement: orderSettlement,
        }),
        orderId: null,
      },
    })

    const supplierIds = [...new Set(lineMeta.map((l) => l.blindDropshipSupplierId))]
    for (const sid of supplierIds) {
      const item = order.items.find((i) => i.blindDropshipSupplierId === sid)
      if (!item) continue
      const linkedUserId = item.blindDropshipSupplier.linkedUserId
      const supplierSlice = aggregateBlindLinesForSupplier(lineMeta, sid)
      const supplierLines = lineMeta.filter((l) => l.blindDropshipSupplierId === sid)
      const names = supplierLines.map((l) => `${l.productName} ×${l.qty}`).join(", ")

      await tx.notification.create({
        data: {
          userId: linkedUserId,
          type: "NEW_ORDER",
          message: formatSupplierNewOrderNotification({
            productName: names,
            variantBit: " · blind dropship",
            qty: 1,
            customerEmail: order.customerEmail,
            storeName: order.affiliate.store?.name ?? null,
            settlement: supplierSlice,
          }),
          orderId: null,
        },
      })
    }
  })
}
