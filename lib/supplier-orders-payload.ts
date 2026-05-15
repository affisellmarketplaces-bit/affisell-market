import type { Prisma } from "@prisma/client"

import { formatOrderShippingAddress } from "@/lib/order-shipping-address"
import { prisma } from "@/lib/prisma"

const orderInclude = {
  product: { select: { id: true, name: true, images: true, supplierSku: true } },
  affiliate: { select: { id: true, name: true, email: true, store: { select: { name: true, slug: true } } } },
  returns: {
    where: { status: { notIn: ["REJECTED", "CANCELLED", "REFUNDED"] as string[] } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, status: true },
  },
} satisfies Prisma.OrderInclude

export { orderInclude as supplierOrderInclude }

export type SupplierOrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

export function mapSupplierOrderRow(o: SupplierOrderRow) {
  const openReturn = o.returns[0] ?? null
  const store = o.affiliate.store
  return {
    id: o.id,
    status: o.status,
    quantity: o.quantity,
    variantLabel: o.variantLabel,
    customerEmail: o.customerEmail,
    sellingPriceCents: o.sellingPriceCents,
    basePriceCents: o.basePriceCents,
    marginCents: o.marginCents,
    createdAt: o.createdAt.toISOString(),
    shippedAt: o.shippedAt?.toISOString() ?? null,
    trackingCarrier: o.trackingCarrier,
    trackingNumber: o.trackingNumber,
    shippingAddressFormatted: formatOrderShippingAddress(o.shippingAddress),
    shippingAddress: o.shippingAddress,
    product: {
      id: o.product.id,
      name: o.product.name,
      imageUrl: o.product.images[0] ?? null,
      supplierSku: o.product.supplierSku,
    },
    affiliate: {
      id: o.affiliate.id,
      name: o.affiliate.name,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
    },
    openReturn: openReturn ? { id: openReturn.id, status: openReturn.status } : null,
  }
}

export async function fetchSupplierOrders(supplierId: string, tab: "to_ship" | "shipped" | "all") {
  const statusFilter =
    tab === "to_ship"
      ? { status: "paid" as const }
      : tab === "shipped"
        ? { status: "shipped" as const }
        : { status: { in: ["paid", "shipped"] as string[] } }

  const rows = await prisma.order.findMany({
    where: { supplierId, ...statusFilter },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: orderInclude,
  })
  return rows.map(mapSupplierOrderRow)
}

export async function countSupplierOrdersToShip(supplierId: string) {
  return prisma.order.count({
    where: { supplierId, status: "paid" },
  })
}
