import { prisma } from "@/lib/prisma"
import { resolveOrderEscrowAllocation } from "@/lib/order-escrow-allocation"
import { evaluateSupplierTransferRelease } from "@/lib/order-transfer-gating"
import type { SupplierEscrowSummary } from "@/lib/supplier-escrow-shared"

export type { SupplierEscrowSummary } from "@/lib/supplier-escrow-shared"

const MARKETPLACE_ACTIVE = ["paid", "preparing", "shipped"] as const

function isUpstreamStillPending(order: {
  usesAffisellAutoBuy: boolean
  autoBuyLog: { status: string } | null
  fulfillmentStatus: string
}): boolean {
  if (!order.usesAffisellAutoBuy) return false
  if (order.autoBuyLog?.status === "BOUGHT") return false
  if (["ORDERED", "SHIPPED", "DELIVERED", "PARTIAL"].includes(order.fulfillmentStatus)) {
    return false
  }
  return true
}

export async function loadSupplierEscrowSummary(supplierUserId: string): Promise<SupplierEscrowSummary> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const orders = await prisma.order.findMany({
    where: {
      supplierId: supplierUserId,
      status: { in: [...MARKETPLACE_ACTIVE] },
    },
    select: {
      id: true,
      usesAffisellAutoBuy: true,
      upstreamCogsCents: true,
      supplierMarginCents: true,
      supplierPayoutCents: true,
      aeWholesaleCents: true,
      fulfillmentStatus: true,
      status: true,
      shippedAt: true,
      trackingNumber: true,
      autoBuyLog: { select: { status: true } },
      transferAttempts: {
        where: { role: "SUPPLIER" },
        select: { status: true, amountCents: true },
      },
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  })

  let upstreamReservedCents = 0
  let marginHeldCents = 0
  let ordersInEscrow = 0
  let autoBuyActive = false

  for (const order of orders) {
    const escrow = resolveOrderEscrowAllocation(order)
    const supplierAttempt = order.transferAttempts[0]
    const supplierReleased = supplierAttempt?.status === "SUCCESS"

    if (order.usesAffisellAutoBuy) autoBuyActive = true

    if (
      order.usesAffisellAutoBuy &&
      escrow.upstreamCogsCents != null &&
      escrow.upstreamCogsCents > 0 &&
      isUpstreamStillPending(order)
    ) {
      upstreamReservedCents += escrow.upstreamCogsCents
      ordersInEscrow += 1
    }

    if (!supplierReleased && escrow.supplierMarginCents > 0) {
      const gate = evaluateSupplierTransferRelease({
        status: order.status,
        usesAffisellAutoBuy: order.usesAffisellAutoBuy,
        shippedAt: order.shippedAt,
        trackingNumber: order.trackingNumber,
        deliveredAt: null,
        deliveryConfirmedAt: null,
        payoutEligibleAt: null,
        fulfillmentStatus: order.fulfillmentStatus,
        autoBuyLogStatus: order.autoBuyLog?.status ?? null,
      })
      if (!gate.eligible) {
        marginHeldCents += escrow.supplierMarginCents
        if (gate.phase !== "awaiting_upstream") ordersInEscrow += 1
      }
    }
  }

  const releasedAgg = await prisma.transferAttempt.aggregate({
    where: {
      role: "SUPPLIER",
      status: "SUCCESS",
      createdAt: { gte: since30d },
      order: { supplierId: supplierUserId },
    },
    _sum: { amountCents: true },
  })

  console.log("[supplier-escrow]", {
    supplierUserId,
    upstreamReservedCents,
    marginHeldCents,
    marginReleasedCents: releasedAgg._sum.amountCents ?? 0,
    ordersInEscrow,
  })

  return {
    upstreamReservedCents,
    marginHeldCents,
    marginReleasedCents: releasedAgg._sum.amountCents ?? 0,
    ordersInEscrow,
    autoBuyActive,
  }
}
