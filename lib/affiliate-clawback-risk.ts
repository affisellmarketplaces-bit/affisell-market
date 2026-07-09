import "server-only"

import type { OrderReturnStatus } from "@/lib/order-return-types"
import { prisma } from "@/lib/prisma"

export const CLAWBACK_RISK_RETURN_STATUSES: OrderReturnStatus[] = [
  "REQUESTED",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT",
  "RECEIVED",
]

export const CLAWBACK_RISK_WINDOW_DAYS = 30
export const CLAWBACK_RISK_WARNING_CENTS = 50_000

function subDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() - days)
  return next
}

export type AffiliateClawbackRiskSummary = {
  riskCents: number
  pendingReturnCount: number
}

export async function loadAffiliateClawbackRisk(
  affiliateId: string
): Promise<AffiliateClawbackRiskSummary> {
  const since = subDays(new Date(), CLAWBACK_RISK_WINDOW_DAYS)

  const pendingReturns = await prisma.orderReturn.findMany({
    where: {
      status: { in: [...CLAWBACK_RISK_RETURN_STATUSES] },
      createdAt: { gte: since },
      order: { affiliateId },
    },
    select: {
      order: {
        select: {
          affiliatePayoutCents: true,
          commissionCents: true,
        },
      },
    },
  })

  const riskCents = pendingReturns.reduce((sum, row) => {
    const payout = row.order.affiliatePayoutCents
    const commission = row.order.commissionCents
    return sum + (payout > 0 ? payout : commission)
  }, 0)

  console.log("[clawback-risk]", {
    affiliateId,
    pendingReturnCount: pendingReturns.length,
    riskCents,
    result: "ok",
  })

  return {
    riskCents,
    pendingReturnCount: pendingReturns.length,
  }
}

export type AffiliateRefundHistoryRow = {
  id: string
  status: string
  createdAt: Date
  orderId: string
  productName: string
  commissionAtRiskCents: number
}

export async function loadAffiliateRefundHistory(
  affiliateId: string,
  limit = 50
): Promise<AffiliateRefundHistoryRow[]> {
  const since = subDays(new Date(), CLAWBACK_RISK_WINDOW_DAYS)

  const rows = await prisma.orderReturn.findMany({
    where: {
      createdAt: { gte: since },
      order: { affiliateId },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      createdAt: true,
      orderId: true,
      order: {
        select: {
          affiliatePayoutCents: true,
          commissionCents: true,
          product: { select: { name: true } },
        },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    orderId: row.orderId,
    productName: row.order.product.name,
    commissionAtRiskCents:
      row.order.affiliatePayoutCents > 0
        ? row.order.affiliatePayoutCents
        : row.order.commissionCents,
  }))
}
