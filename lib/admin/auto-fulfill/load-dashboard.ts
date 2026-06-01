import type { AutoBuyStatus } from "@prisma/client"

import { orderUsesAffisellAutoBuy } from "@/lib/marketplace-supplier-fee"
import { prisma } from "@/lib/prisma"

export type AdminAutoFulfillProductRow = {
  id: string
  name: string
  supplierEmail: string
  supplierStoreName: string | null
  active: boolean
  isDraft: boolean
  hasSupplierLink: boolean
  autoBuyEnabled: boolean
  aeProductId: string | null
  aePriceCents: number | null
  lastSyncAt: string | null
}

export type AdminAutoFulfillLogRow = {
  id: string
  orderId: string
  productId: string
  productName: string
  customerEmail: string
  status: AutoBuyStatus
  attempts: number
  aeOrderId: string | null
  aeTracking: string | null
  errorMsg: string | null
  clientTotalCents: number | null
  aeWholesaleCents: number | null
  supplierFeeCents: number
  affiliateFeeCents: number
  usesAffisellAutoBuy: boolean
  createdAt: string
  updatedAt: string
}

export type AdminAutoFulfillDashboard = {
  stats: {
    productsWithLink: number
    productsAutoBuyOn: number
    logsPending: number
    logsBuying: number
    logsBought: number
    logsFailed: number
    logsRefunded: number
  }
  products: AdminAutoFulfillProductRow[]
  recentLogs: AdminAutoFulfillLogRow[]
}

export async function loadAdminAutoFulfillDashboard(
  opts?: { productQ?: string; take?: number }
): Promise<AdminAutoFulfillDashboard> {
  const take = Math.min(100, Math.max(10, opts?.take ?? 50))
  const q = opts?.productQ?.trim()

  const productWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { id: q },
          { aliexpressProductId: q },
          { supplier: { email: { contains: q, mode: "insensitive" as const } } },
          { supplier: { store: { name: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : {}

  const [
    productsWithLink,
    productsAutoBuyOn,
    logsPending,
    logsBuying,
    logsBought,
    logsFailed,
    logsRefunded,
    products,
    recentLogs,
  ] = await Promise.all([
    prisma.supplierLink.count({ where: { isActive: true } }),
    prisma.supplierLink.count({ where: { isActive: true, autoBuyEnabled: true } }),
    prisma.fulfillmentLog.count({ where: { status: "PENDING" } }),
    prisma.fulfillmentLog.count({ where: { status: "BUYING" } }),
    prisma.fulfillmentLog.count({ where: { status: "BOUGHT" } }),
    prisma.fulfillmentLog.count({ where: { status: "FAILED" } }),
    prisma.fulfillmentLog.count({ where: { status: "REFUNDED" } }),
    prisma.product.findMany({
      where: productWhere,
      take,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        active: true,
        isDraft: true,
        aliexpressProductId: true,
        supplier: {
          select: {
            email: true,
            store: { select: { name: true } },
          },
        },
        supplierLink: {
          select: {
            autoBuyEnabled: true,
            aeProductId: true,
            aePriceCents: true,
            lastSyncAt: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.fulfillmentLog.findMany({
      take: 30,
      orderBy: { updatedAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            customerEmail: true,
            totalCents: true,
            sellingPriceCents: true,
            aeWholesaleCents: true,
            usesAffisellAutoBuy: true,
            supplierFeeCents: true,
            affiliateFeeCents: true,
            product: {
              select: {
                id: true,
                name: true,
                autoBuyEnabled: true,
                supplierLink: {
                  select: { isActive: true, autoBuyEnabled: true },
                },
              },
            },
          },
        },
      },
    }),
  ])

  return {
    stats: {
      productsWithLink,
      productsAutoBuyOn,
      logsPending,
      logsBuying,
      logsBought,
      logsFailed,
      logsRefunded,
    },
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      supplierEmail: p.supplier.email,
      supplierStoreName: p.supplier.store?.name ?? null,
      active: p.active,
      isDraft: p.isDraft,
      hasSupplierLink: Boolean(p.supplierLink?.isActive),
      autoBuyEnabled: p.supplierLink?.autoBuyEnabled ?? false,
      aeProductId: p.supplierLink?.aeProductId ?? p.aliexpressProductId,
      aePriceCents: p.supplierLink?.aePriceCents ?? null,
      lastSyncAt: p.supplierLink?.lastSyncAt?.toISOString() ?? null,
    })),
    recentLogs: recentLogs.map((log) => ({
      id: log.id,
      orderId: log.orderId,
      productId: log.order.product.id,
      productName: log.order.product.name,
      customerEmail: log.order.customerEmail,
      status: log.status,
      attempts: log.attempts,
      aeOrderId: log.aeOrderId,
      aeTracking: log.aeTracking,
      errorMsg: log.errorMsg,
      clientTotalCents: log.order.totalCents ?? log.order.sellingPriceCents,
      aeWholesaleCents: log.order.aeWholesaleCents,
      supplierFeeCents: log.order.supplierFeeCents,
      affiliateFeeCents: log.order.affiliateFeeCents,
      usesAffisellAutoBuy:
        log.order.usesAffisellAutoBuy ??
        orderUsesAffisellAutoBuy({
          supplierLink: log.order.product.supplierLink,
          productAutoBuyEnabled: log.order.product.autoBuyEnabled,
        }),
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    })),
  }
}
