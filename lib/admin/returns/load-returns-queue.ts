import { ORDER_RETURN_STATUSES } from "@/lib/order-return-types"
import type { OrderReturnStatus } from "@/lib/order-return-types"
import { resolveSupplierPayoutCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { prisma } from "@/lib/prisma"

export type AdminReturnListRow = {
  id: string
  status: OrderReturnStatus
  reasonCode: string
  reasonDetail: string | null
  requestedRefundCents: number
  approvedRefundCents: number | null
  sellerRespondByAt: string | null
  createdAt: string
  order: {
    id: string
    customerEmail: string | null
    supplierEmail: string | null
    productName: string
    productImageUrl: string | null
    supplierNetCents: number
  }
}

export type AdminReturnsStats = {
  requested: number
  awaitingShipment: number
  inTransit: number
  received: number
  terminal: number
}

export type AdminReturnsQueueResponse = {
  stats: AdminReturnsStats
  rows: AdminReturnListRow[]
}

const ACTIVE_STATUSES: OrderReturnStatus[] = [
  "REQUESTED",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT",
  "RECEIVED",
]

export function parseReturnsStatusFilter(raw: string | null): OrderReturnStatus | "all" | "active" {
  if (!raw || raw === "active") return "active"
  if (raw === "all") return "all"
  return (ORDER_RETURN_STATUSES as readonly string[]).includes(raw)
    ? (raw as OrderReturnStatus)
    : "active"
}

export async function loadAdminReturnsStats(): Promise<AdminReturnsStats> {
  const grouped = await prisma.orderReturn.groupBy({
    by: ["status"],
    _count: { _all: true },
  })
  const map = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]))
  return {
    requested: map.REQUESTED ?? 0,
    awaitingShipment: map.AWAITING_SHIPMENT ?? 0,
    inTransit: map.IN_TRANSIT ?? 0,
    received: map.RECEIVED ?? 0,
    terminal: (map.REFUNDED ?? 0) + (map.REJECTED ?? 0) + (map.CANCELLED ?? 0),
  }
}

export async function loadAdminReturnsQueue(
  statusFilter: ReturnType<typeof parseReturnsStatusFilter> = "active"
): Promise<AdminReturnsQueueResponse> {
  const where =
    statusFilter === "all"
      ? undefined
      : statusFilter === "active"
        ? { status: { in: ACTIVE_STATUSES } }
        : { status: statusFilter }

  const [stats, rows] = await Promise.all([
    loadAdminReturnsStats(),
    prisma.orderReturn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        order: {
          select: {
            id: true,
            customerEmail: true,
            basePriceCents: true,
            supplierPriceCents: true,
            supplierPayoutCents: true,
            supplierCommissionRateBps: true,
            usesAffisellAutoBuy: true,
            supplierFeeCents: true,
            aeWholesaleCents: true,
            affiliatePayoutCents: true,
            quantity: true,
            product: { select: { name: true, images: true } },
            supplier: { select: { email: true } },
          },
        },
      },
    }),
  ])

  return {
    stats,
    rows: rows.map((r) => {
      const { supplier, product, ...settlementInput } = r.order
      return {
        id: r.id,
        status: r.status as OrderReturnStatus,
        reasonCode: r.reasonCode,
        reasonDetail: r.reasonDetail,
        requestedRefundCents: r.requestedRefundCents,
        approvedRefundCents: r.approvedRefundCents,
        sellerRespondByAt: r.sellerRespondByAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        order: {
          id: r.order.id,
          customerEmail: r.order.customerEmail,
          supplierEmail: supplier?.email ?? null,
          productName: product.name,
          productImageUrl: product.images[0] ?? null,
          supplierNetCents: resolveSupplierPayoutCentsFromOrder(settlementInput),
        },
      }
    }),
  }
}
