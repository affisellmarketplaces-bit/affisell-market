import type { Prisma } from "@prisma/client"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  isPayoutBlockedByReturn,
  isReadyForMerchantPayout,
  payoutEligibleAfterBuyerConfirm,
  shouldAutoConfirmDelivery,
  type DeliveryConfirmedBy,
} from "@/lib/order-payout-policy"
import { confirmBlindDropshipDeliveryByBuyer } from "@/lib/blind-dropship-payout"
import { recordMerchantPayoutEntry } from "@/lib/payout-ledger"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

const orderPayoutSelect = {
  id: true,
  status: true,
  supplierId: true,
  affiliateId: true,
  productId: true,
  basePriceCents: true,
  affiliatePayoutCents: true,
  affiliateMarginRetainedCents: true,
  deliveredAt: true,
  shippedAt: true,
  deliveryConfirmedAt: true,
  deliveryConfirmedBy: true,
  payoutEligibleAt: true,
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

  return {
    ok: true as const,
    payoutEligibleAt: payoutEligibleAt.toISOString(),
    message:
      "Thank you — seller payouts are scheduled 7 days after this confirmation. You may still exercise your right of withdrawal within the return window if applicable.",
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

export async function executeOrderMerchantPayout(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  return prisma.$transaction(async (tx) => {
    let order = await tx.order.findUnique({
      where: { id: orderId },
      select: orderPayoutSelect,
    })
    if (!order) return { ok: false, reason: "not_found" }

    const returns = await tx.orderReturn.findMany({ where: { orderId } })
    if (isPayoutBlockedByReturn(returns)) return { ok: false, reason: "return_open" }

    order = await applyAutoConfirmIfNeeded(tx, order)
    if (!isReadyForMerchantPayout(order, returns)) {
      return { ok: false, reason: "not_eligible" }
    }

    const supplierAmount = order.basePriceCents
    const affiliateAmount = order.affiliatePayoutCents + order.affiliateMarginRetainedCents
    const now = new Date()
    let supplierPayoutAt = order.supplierPayoutAt
    let affiliatePayoutAt = order.affiliatePayoutAt

    const product = await tx.product.findUnique({ where: { id: order.productId }, select: { name: true } })

    if (!supplierPayoutAt) {
      const paid = await recordMerchantPayoutEntry(tx, {
        orderId: order.id,
        userId: order.supplierId,
        beneficiaryRole: "SUPPLIER",
        amountCents: supplierAmount,
        idempotencyKey: `payout:supplier:${order.id}`,
        note: `Supplier wholesale payout · ${product?.name ?? "order"}`,
      })
      if (paid) {
        supplierPayoutAt = now
        await tx.notification.create({
          data: {
            userId: order.supplierId,
            type: "PAYOUT_SENT",
            message: `Payout released · ${product?.name ?? "Order"} · ${formatStoreCurrencyFromCents(supplierAmount)} (wholesale). Buyers may still return within the legal window — refunds remain mandatory if approved.`,
            orderId: order.id,
          },
        })
      }
    }

    if (!affiliatePayoutAt) {
      const paid = await recordMerchantPayoutEntry(tx, {
        orderId: order.id,
        userId: order.affiliateId,
        beneficiaryRole: "AFFILIATE",
        amountCents: affiliateAmount,
        idempotencyKey: `payout:affiliate:${order.id}`,
        note: `Affiliate earnings payout · ${product?.name ?? "order"}`,
      })
      if (paid) {
        affiliatePayoutAt = now
        await tx.notification.create({
          data: {
            userId: order.affiliateId,
            type: "PAYOUT_SENT",
            message: `Payout released · ${product?.name ?? "Order"} · ${formatStoreCurrencyFromCents(affiliateAmount)}. If the buyer returns and is refunded later, you must reimburse your share.`,
            orderId: order.id,
          },
        })
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        supplierPayoutAt,
        affiliatePayoutAt,
      },
    })

    return { ok: true }
  })
}

export async function clawbackOrderPayoutsOnRefund(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      supplierId: true,
      affiliateId: true,
      basePriceCents: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      supplierPayoutAt: true,
      affiliatePayoutAt: true,
      product: { select: { name: true } },
    },
  })
  if (!order) return

  const productName = order.product.name

  await prisma.$transaction(async (tx) => {
    if (order.supplierPayoutAt) {
      const amount = order.basePriceCents
      try {
        await recordMerchantPayoutEntry(tx, {
          orderId: order.id,
          userId: order.supplierId,
          beneficiaryRole: "SUPPLIER",
          amountCents: amount,
          idempotencyKey: `clawback:supplier:${order.id}`,
          note: `Mandatory refund clawback · ${productName}`,
          entryType: "CLAWBACK",
        })
        await tx.notification.create({
          data: {
            userId: order.supplierId,
            type: "PAYOUT_CLAWBACK",
            message: `Refund obligation · ${productName} · reimburse ${formatStoreCurrencyFromCents(amount)} (payout was already released; buyer refund is mandatory).`,
            orderId: order.id,
          },
        })
      } catch (e) {
        if ((e as { code?: string })?.code !== "P2002") throw e
      }
    }

    if (order.affiliatePayoutAt) {
      const amount = order.affiliatePayoutCents + order.affiliateMarginRetainedCents
      if (amount > 0) {
        try {
          await recordMerchantPayoutEntry(tx, {
            orderId: order.id,
            userId: order.affiliateId,
            beneficiaryRole: "AFFILIATE",
            amountCents: amount,
            idempotencyKey: `clawback:affiliate:${order.id}`,
            note: `Mandatory refund clawback · ${productName}`,
            entryType: "CLAWBACK",
          })
          await tx.notification.create({
            data: {
              userId: order.affiliateId,
              type: "PAYOUT_CLAWBACK",
              message: `Refund obligation · ${productName} · reimburse ${formatStoreCurrencyFromCents(amount)} (earnings were paid out; buyer refund must be honored).`,
              orderId: order.id,
            },
          })
        } catch (e) {
          if ((e as { code?: string })?.code !== "P2002") throw e
        }
      }
    }
  })
}

export async function processDueOrderPayouts(limit = 100): Promise<{
  marketplace: { processed: number; paid: number; skipped: number }
  blind: { processed: number; paid: number; skipped: number }
}> {
  const { processDueBlindDropshipPayouts } = await import("@/lib/blind-dropship-payout")

  const candidates = await prisma.order.findMany({
    where: {
      status: "shipped",
      OR: [{ supplierPayoutAt: null }, { affiliatePayoutAt: null }],
      shippedAt: { not: null },
    },
    orderBy: { shippedAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let paid = 0
  let skipped = 0
  for (const { id } of candidates) {
    const r = await executeOrderMerchantPayout(id)
    if (r.ok) paid++
    else skipped++
  }

  const blind = await processDueBlindDropshipPayouts(limit)

  return {
    marketplace: { processed: candidates.length, paid, skipped },
    blind,
  }
}
