import "server-only"

import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma

export type ActiveLegionBoostCommission = {
  boostId: string
  /** Affiliate commission in basis points for this sale (e.g. 4000 = 40%). */
  commissionBps: number
  boostMarginRate: number
}

/**
 * Active Légion Battle window for a product — temporary commission override
 * (never mutates Product.commissionRate; snapshot applied only on this order).
 */
export async function resolveActiveLegionBoostCommission(
  db: Tx,
  productId: string,
  now: Date = new Date()
): Promise<ActiveLegionBoostCommission | null> {
  const boost = await db.legionBoost.findFirst({
    where: {
      productId,
      status: "active",
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "asc" },
    select: { id: true, boostMarginRate: true },
  })
  if (!boost) return null

  const rate = Number(boost.boostMarginRate)
  if (!Number.isFinite(rate) || rate <= 0) return null

  const commissionBps = Math.min(9900, Math.max(100, Math.round(rate * 10_000)))
  return {
    boostId: boost.id,
    commissionBps,
    boostMarginRate: rate,
  }
}

export async function recordLegionBoostSale(
  db: Tx,
  args: { boostId: string; qty: number; gmvCents: number }
): Promise<void> {
  const gmvEur = Math.round(Math.max(0, args.gmvCents)) / 100
  await db.legionBoost.update({
    where: { id: args.boostId },
    data: {
      boostSalesCount: { increment: Math.max(1, args.qty) },
      boostGmv: { increment: gmvEur },
    },
  })
}
