/**
 * Escrow allocation snapshot at checkout — client-safe (no Prisma).
 * upstreamCogs = pool reserved to pay supplier's upstream (auto-buy).
 * supplierMargin = net Connect transfer to supplier after fulfillment gates.
 */

export type OrderEscrowAllocationInput = {
  usesAffisellAutoBuy: boolean
  aeWholesaleCents?: number | null
  supplierPayoutCents: number
}

export type OrderEscrowAllocation = {
  upstreamCogsCents: number | null
  supplierMarginCents: number
}

export function computeOrderEscrowAllocation(
  input: OrderEscrowAllocationInput
): OrderEscrowAllocation {
  const supplierMarginCents = Math.max(0, Math.round(input.supplierPayoutCents))
  const ae = input.aeWholesaleCents != null ? Math.round(input.aeWholesaleCents) : null

  if (!input.usesAffisellAutoBuy) {
    return { upstreamCogsCents: null, supplierMarginCents }
  }

  return {
    upstreamCogsCents: ae != null && ae > 0 ? ae : null,
    supplierMarginCents,
  }
}

/** Resolve allocation from persisted order row (backfill when null). */
export function resolveOrderEscrowAllocation(order: {
  usesAffisellAutoBuy?: boolean | null
  aeWholesaleCents?: number | null
  supplierPayoutCents?: number | null
  supplierMarginCents?: number | null
  upstreamCogsCents?: number | null
}): OrderEscrowAllocation {
  if (order.supplierMarginCents != null && order.supplierMarginCents >= 0) {
    return {
      upstreamCogsCents: order.upstreamCogsCents ?? null,
      supplierMarginCents: order.supplierMarginCents,
    }
  }

  return computeOrderEscrowAllocation({
    usesAffisellAutoBuy: Boolean(order.usesAffisellAutoBuy),
    aeWholesaleCents: order.aeWholesaleCents,
    supplierPayoutCents: order.supplierPayoutCents ?? 0,
  })
}
