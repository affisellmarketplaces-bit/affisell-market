import type { Prisma } from "@prisma/client"

import {
  isPayoutBlockedByReturn,
  isReadyForMerchantPayout,
  payoutEligibleAfterBuyerConfirm,
  shouldAutoConfirmDelivery,
  type DeliveryConfirmedBy,
} from "@/lib/order-payout-policy"
import { confirmBlindDropshipDeliveryByBuyer } from "@/lib/blind-dropship-payout"
import {
  loadOrderClawbackContext,
  recordClawbackIfPaidOut,
  resolvedClawbackAmountCents,
  roleWasPaidOut,
} from "@/lib/payout-settlement"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

const orderPayoutSelect = {
  id: true,
  status: true,
  deliveredAt: true,
  shippedAt: true,
  deliveryConfirmedAt: true,
  deliveryConfirmedBy: true,
  payoutEligibleAt: true,
  payoutStatus: true,
  supplierPayoutAt: true,
  affiliatePayoutAt: true,
} as const

export async function confirmOrderDeliveryByBuyer(orderId: string, buyerUserId: string | null, buyerEmail: string) {
  const blind = await confirmBlindDropshipDeliveryByBuyer(orderId, buyerUserId, buyerEmail)
  if (blind.ok || (blind.error !== "not_found")) return blind

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { returns: true, product: { select: { name: true } } },
  })
  if (!order) return { ok: false as const, error: "not_found" }
  if (order.status !== "shipped") {
    return { ok: false as const, error: "not_shipped" }
  }
  if (!order.deliveredAt && !order.shippedAt) {
    return { ok: false as const, error: "not_delivered" }
  }
  if (order.deliveryConfirmedAt) {
    return { ok: false as const, error: "already_confirmed" }
  }
  if (isPayoutBlockedByReturn(order.returns)) {
    return { ok: false as const, error: "return_open" }
  }

  const emailOk =
    buyerEmail.trim().toLowerCase() === order.customerEmail.trim().toLowerCase() ||
    (buyerUserId && order.buyerUserId === buyerUserId)
  if (!emailOk) return { ok: false as const, error: "forbidden" }

  const now = new Date()
  const payoutEligibleAt = payoutEligibleAfterBuyerConfirm(now)

  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryConfirmedAt: now,
      deliveryConfirmedBy: "buyer",
      payoutEligibleAt,
    },
  })

  const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
  triggerOrderTransferRelease(orderId)

  return {
    ok: true as const,
    payoutEligibleAt: payoutEligibleAt.toISOString(),
    message:
      "Thank you — your delivery is confirmed. You may still exercise your right of withdrawal within the return window if applicable.",
  }
}

async function applyAutoConfirmIfNeeded(
  tx: Tx,
  order: Prisma.OrderGetPayload<{ select: typeof orderPayoutSelect }>
): Promise<Prisma.OrderGetPayload<{ select: typeof orderPayoutSelect }>> {
  if (order.deliveryConfirmedAt) return order
  if (!shouldAutoConfirmDelivery(order)) return order

  const now = new Date()
  return tx.order.update({
    where: { id: order.id },
    data: {
      deliveryConfirmedAt: now,
      deliveryConfirmedBy: "auto_no_response" satisfies DeliveryConfirmedBy,
      payoutEligibleAt: now,
    },
    select: orderPayoutSelect,
  })
}

/**
 * Advance delivery confirmation timers only — no money movement.
 * Stripe Connect transfers are the sole payout rail for marketplace orders.
 */
export async function advanceMarketplacePayoutEligibility(
  orderId: string
): Promise<{ ok: boolean; reason?: string; autoConfirmed?: boolean }> {
  return prisma.$transaction(async (tx) => {
    let order = await tx.order.findUnique({
      where: { id: orderId },
      select: orderPayoutSelect,
    })
    if (!order) return { ok: false, reason: "not_found" }
    if (order.payoutStatus === "PAID") return { ok: false, reason: "already_paid" }

    const returns = await tx.orderReturn.findMany({ where: { orderId } })
    if (isPayoutBlockedByReturn(returns)) return { ok: false, reason: "return_open" }

    const hadConfirm = order.deliveryConfirmedAt != null
    order = await applyAutoConfirmIfNeeded(tx, order)
    const autoConfirmed = !hadConfirm && order.deliveryConfirmedAt != null

    if (!isReadyForMerchantPayout(order, returns)) {
      return { ok: false, reason: "not_eligible", autoConfirmed }
    }

    return { ok: true, autoConfirmed }
  })
}

/**
 * @deprecated Marketplace payouts flow through Stripe Connect (`process-transfers`).
 * Kept as alias for eligibility advance — does not write ledger entries.
 */
export async function executeOrderMerchantPayout(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const r = await advanceMarketplacePayoutEligibility(orderId)
  if (r.ok || r.autoConfirmed) {
    const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
    triggerOrderTransferRelease(orderId)
  }
  return { ok: r.ok, reason: r.reason }
}

export async function clawbackOrderPayoutsOnRefund(orderId: string): Promise<void> {
  const order = await loadOrderClawbackContext(orderId)
  if (!order) return

  const productName = order.product.name

  await prisma.$transaction(async (tx) => {
    if (roleWasPaidOut("SUPPLIER", order)) {
      const amount = resolvedClawbackAmountCents("SUPPLIER", order)
      await recordClawbackIfPaidOut(tx, {
        orderId: order.id,
        beneficiaryRole: "SUPPLIER",
        userId: order.supplierId,
        amountCents: amount,
        productName,
      })
    }

    if (roleWasPaidOut("AFFILIATE", order)) {
      const amount = resolvedClawbackAmountCents("AFFILIATE", order)
      if (amount > 0) {
        await recordClawbackIfPaidOut(tx, {
          orderId: order.id,
          beneficiaryRole: "AFFILIATE",
          userId: order.affiliateId,
          amountCents: amount,
          productName,
        })
      }
    }
  })
}

/**
 * Marketplace: auto-confirm delivery windows + enqueue Connect transfers.
 * Blind dropship: internal ledger rail unchanged.
 */
export async function processDueOrderPayouts(limit = 100): Promise<{
  marketplace: { processed: number; advanced: number; skipped: number }
  blind: { processed: number; paid: number; skipped: number }
}> {
  const { processDueBlindDropshipPayouts } = await import("@/lib/blind-dropship-payout")

  const candidates = await prisma.order.findMany({
    where: {
      status: "shipped",
      shippedAt: { not: null },
      payoutStatus: { notIn: ["PAID", "PROCESSING"] },
      OR: [
        { deliveryConfirmedAt: null, deliveredAt: { not: null } },
        {
          AND: [
            { deliveryConfirmedAt: { not: null } },
            { OR: [{ supplierPayoutAt: null }, { affiliatePayoutAt: null }] },
          ],
        },
      ],
    },
    orderBy: { shippedAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let advanced = 0
  let skipped = 0
  const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")

  for (const { id } of candidates) {
    const r = await advanceMarketplacePayoutEligibility(id)
    if (r.ok || r.autoConfirmed) {
      advanced++
      triggerOrderTransferRelease(id)
    } else {
      skipped++
    }
  }

  const blind = await processDueBlindDropshipPayouts(limit)

  return {
    marketplace: { processed: candidates.length, advanced, skipped },
    blind,
  }
}
