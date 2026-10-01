import "server-only"

import { prisma } from "@/lib/prisma"

/** Lanceur's pitched monthly order volume ("100 commandes/mois sans friction") — display only. */
export const LANCEUR_MONTHLY_ORDER_REFERENCE = 100

/**
 * Observability only — never blocks. An affiliate's order count this calendar month, via the
 * existing @@index([affiliateId]) + an in-row createdAt filter. No cap is enforced against the
 * live order-creation path (see lib/growth/order-volume.server.ts's module doc in the plan):
 * orders are created because a customer already paid Stripe, so gating that on the affiliate's
 * subscription risks failing to fulfill a payment someone already made.
 */
export async function loadMonthlyAffiliateOrderCount(affiliateId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return prisma.order.count({ where: { affiliateId, createdAt: { gte: startOfMonth } } })
}
