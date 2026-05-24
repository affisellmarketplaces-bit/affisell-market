import type { AdminOrdersListQuery } from "@/lib/admin/orders/list-query"
import { buildAdminOrdersWhere } from "@/lib/admin/orders/list-query"
import {
  toAdminOrderListRow,
  type AdminOrderListRow,
} from "@/lib/admin/orders/serialize-list"
import { prisma } from "@/lib/prisma"

export async function listAdminOrders(query: AdminOrdersListQuery): Promise<AdminOrderListRow[]> {
  const orders = await prisma.order.findMany({
    where: buildAdminOrdersWhere(query),
    take: query.take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerEmail: true,
      sellingPriceCents: true,
      totalCents: true,
      status: true,
      splitStatus: true,
      fulfillmentStatus: true,
      trackingNumber: true,
      createdAt: true,
      transferAttempts: {
        select: {
          role: true,
          status: true,
          amountCents: true,
          destination: true,
          errorCode: true,
        },
      },
      supplierFulfillmentLinks: {
        select: {
          supplierFulfillmentOrder: {
            select: { provider: { select: { name: true } } },
          },
        },
      },
    },
  })

  return orders.map(toAdminOrderListRow)
}
