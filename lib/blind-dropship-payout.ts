import type { Prisma } from "@prisma/client"

import { aggregateBlindLinesForSupplier } from "@/lib/blind-dropship-settlement"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  isReadyForMerchantPayout,
  payoutEligibleAfterBuyerConfirm,
  shouldAutoConfirmDelivery,
  type DeliveryConfirmedBy,
} from "@/lib/order-payout-policy"
import { recordMerchantPayoutEntry } from "@/lib/payout-ledger"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

const blindPayoutSelect = {
  id: true,
  status: true,
  affiliateId: true,
  totalPaidCents: true,
  totalCostCents: true,
  affiliateCommissionCents: true,
  affiliateMarginRetainedCents: true,
  deliveredAt: true,
  deliveryConfirmedAt: true,
  deliveryConfirmedBy: true,
  payoutEligibleAt: true,
  supplierPayoutAt: true,
  affiliatePayoutAt: true,
  customerEmail: true,
} as const

type BlindPayoutRow = Prisma.BlindDropshipOrderGetPayload<{ select: typeof blindPayoutSelect }>

function blindTimingAdapter(order: BlindPayoutRow) {
  return {
    shippedAt: order.deliveredAt,
    deliveredAt: order.deliveredAt,
    deliveryConfirmedAt: order.deliveryConfirmedAt,
    deliveryConfirmedBy: order.deliveryConfirmedBy,
    payoutEligibleAt: order.payoutEligibleAt,
  }
}

function isBlindPayoutBlocked(order: BlindPayoutRow): boolean {
  return order.status === "refunded" || order.status === "pending_payment" || order.status === "failed"
}

function isBlindReadyForPayout(order: BlindPayoutRow, now = new Date()): boolean {
  if (order.status !== "shipped") return false
  if (!order.deliveredAt) return false
  if (isBlindPayoutBlocked(order)) return false
  if (order.supplierPayoutAt && order.affiliatePayoutAt) return false
  return isReadyForMerchantPayout(
    {
      status: "shipped",
      ...blindTimingAdapter(order),
      supplierPayoutAt: order.supplierPayoutAt,
      affiliatePayoutAt: order.affiliatePayoutAt,
    },
    [],
    now
  )
}

async function applyBlindAutoConfirmIfNeeded(tx: Tx, order: BlindPayoutRow): Promise<BlindPayoutRow> {
  if (order.deliveryConfirmedAt) return order
  if (!shouldAutoConfirmDelivery(blindTimingAdapter(order))) return order
  const now = new Date()
  return tx.blindDropshipOrder.update({
    where: { id: order.id },
    data: {
      deliveryConfirmedAt: now,
      deliveryConfirmedBy: "auto_no_response" satisfies DeliveryConfirmedBy,
      payoutEligibleAt: now,
    },
    select: blindPayoutSelect,
  })
}

export async function confirmBlindDropshipDeliveryByBuyer(
  orderId: string,
  buyerUserId: string | null,
  buyerEmail: string
) {
  const order = await prisma.blindDropshipOrder.findUnique({
    where: { id: orderId },
    select: { ...blindPayoutSelect, buyerUserId: true },
  })
  if (!order) return { ok: false as const, error: "not_found" }
  if (order.status !== "shipped") return { ok: false as const, error: "not_shipped" }
  if (!order.deliveredAt) return { ok: false as const, error: "not_delivered" }
  if (order.deliveryConfirmedAt) return { ok: false as const, error: "already_confirmed" }
  if (isBlindPayoutBlocked(order)) return { ok: false as const, error: "return_open" }

  const emailOk =
    buyerEmail.trim().toLowerCase() === order.customerEmail.trim().toLowerCase() ||
    (buyerUserId && order.buyerUserId === buyerUserId)
  if (!emailOk) return { ok: false as const, error: "forbidden" }

  const now = new Date()
  const payoutEligibleAt = payoutEligibleAfterBuyerConfirm(now)
  await prisma.blindDropshipOrder.update({
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
      "Thank you — your delivery is confirmed. You may still exercise your right of withdrawal within the return window if applicable.",
  }
}

export async function executeBlindDropshipMerchantPayout(
  orderId: string
): Promise<{ ok: boolean; reason?: string }> {
  return prisma.$transaction(async (tx) => {
    let order = await tx.blindDropshipOrder.findUnique({
      where: { id: orderId },
      select: blindPayoutSelect,
    })
    if (!order) return { ok: false, reason: "not_found" }
    if (isBlindPayoutBlocked(order)) return { ok: false, reason: "blocked" }

    order = await applyBlindAutoConfirmIfNeeded(tx, order)
    if (!isBlindReadyForPayout(order)) return { ok: false, reason: "not_eligible" }

    const items = await tx.blindDropshipOrderItem.findMany({
      where: { blindDropshipOrderId: order.id },
      include: {
        product: { select: { name: true } },
        blindDropshipSupplier: { select: { id: true, linkedUserId: true } },
      },
    })

    const now = new Date()
    let suppliersPaidCount = 0
    const supplierGroups = new Map<string, { linkedUserId: string; amount: number; label: string }>()

    for (const it of items) {
      const slice = aggregateBlindLinesForSupplier(
        [
          {
            blindDropshipSupplierId: it.blindDropshipSupplierId,
            settlement: {
              sellingPriceCents: it.linePaidCents,
              basePriceCents: it.supplierPriceAtOrderCents * it.quantity,
              marginCents: it.marginCents,
              affisellFeeBaseCents: it.linePaidCents,
              affisellFeeCents: it.affisellFeeCents,
              affiliateCommissionCents: it.affiliateCommissionCents,
              affiliateMarginRetainedCents: it.affiliateMarginRetainedCents,
              supplierNetCents: it.supplierPriceAtOrderCents * it.quantity,
            },
          },
        ],
        it.blindDropshipSupplierId
      )
      const g = supplierGroups.get(it.blindDropshipSupplierId)
      const amount = slice.supplierNetCents
      if (g) {
        g.amount += amount
        g.label += `, ${it.product.name}`
      } else {
        supplierGroups.set(it.blindDropshipSupplierId, {
          linkedUserId: it.blindDropshipSupplier.linkedUserId,
          amount,
          label: it.product.name,
        })
      }
    }

    let supplierPayoutAt = order.supplierPayoutAt
    for (const [sid, g] of supplierGroups) {
      const existing = await tx.merchantPayoutLedger.findUnique({
        where: { idempotencyKey: `payout:blind:supplier:${order.id}:${sid}` },
      })
      if (existing) {
        suppliersPaidCount++
        continue
      }

      const paid = await recordMerchantPayoutEntry(tx, {
        blindDropshipOrderId: order.id,
        userId: g.linkedUserId,
        beneficiaryRole: "SUPPLIER",
        amountCents: g.amount,
        idempotencyKey: `payout:blind:supplier:${order.id}:${sid}`,
        note: `Blind dropship wholesale · ${g.label}`,
      })
      if (paid) {
        suppliersPaidCount++
        await tx.notification.create({
          data: {
            userId: g.linkedUserId,
            type: "PAYOUT_SENT",
            message: `Blind dropship payout · ${g.label} · ${formatStoreCurrencyFromCents(g.amount)} (wholesale). Buyer may still return — mandatory refund if approved.`,
            orderId: null,
          },
        })
      }
    }

    if (!supplierPayoutAt && supplierGroups.size > 0 && suppliersPaidCount >= supplierGroups.size) {
      supplierPayoutAt = now
    }

    let affiliatePayoutAt = order.affiliatePayoutAt
    const affiliateAmount = order.affiliateCommissionCents + order.affiliateMarginRetainedCents
    if (!affiliatePayoutAt && affiliateAmount > 0) {
      const paid = await recordMerchantPayoutEntry(tx, {
        blindDropshipOrderId: order.id,
        userId: order.affiliateId,
        beneficiaryRole: "AFFILIATE",
        amountCents: affiliateAmount,
        idempotencyKey: `payout:blind:affiliate:${order.id}`,
        note: `Blind dropship affiliate earnings`,
      })
      if (paid) {
        affiliatePayoutAt = now
        await tx.notification.create({
          data: {
            userId: order.affiliateId,
            type: "PAYOUT_SENT",
            message: `Blind dropship payout · ${formatStoreCurrencyFromCents(affiliateAmount)}. Mandatory reimbursement if buyer is refunded later.`,
            orderId: null,
          },
        })
      }
    } else if (!affiliatePayoutAt && affiliateAmount < 1) {
      affiliatePayoutAt = now
    }

    await tx.blindDropshipOrder.update({
      where: { id: order.id },
      data: { supplierPayoutAt, affiliatePayoutAt },
    })

    return { ok: true }
  })
}

export async function clawbackBlindDropshipPayoutsOnRefund(orderId: string): Promise<void> {
  const order = await prisma.blindDropshipOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
          blindDropshipSupplier: { select: { id: true, linkedUserId: true } },
        },
      },
    },
  })
  if (!order) return

  const affiliateAmount = order.affiliateCommissionCents + order.affiliateMarginRetainedCents
  const label =
    order.items.length === 1
      ? order.items[0]!.product.name
      : `${order.items.length} items`

  if (!order.supplierPayoutAt && !order.affiliatePayoutAt) return

  await prisma.$transaction(async (tx) => {
    const supplierGroups = new Map<string, number>()
    for (const it of order.items) {
      const amt = it.supplierPriceAtOrderCents * it.quantity
      supplierGroups.set(
        it.blindDropshipSupplierId,
        (supplierGroups.get(it.blindDropshipSupplierId) ?? 0) + amt
      )
    }

    for (const [sid, amount] of supplierGroups) {
      if (!order.supplierPayoutAt) continue
      const linkedUserId = order.items.find((i) => i.blindDropshipSupplierId === sid)!.blindDropshipSupplier
        .linkedUserId
      await recordMerchantPayoutEntry(tx, {
        blindDropshipOrderId: order.id,
        userId: linkedUserId,
        beneficiaryRole: "SUPPLIER",
        amountCents: amount,
        idempotencyKey: `clawback:blind:supplier:${order.id}:${sid}`,
        note: `Blind refund clawback · ${label}`,
        entryType: "CLAWBACK",
      })
      await tx.notification.create({
        data: {
          userId: linkedUserId,
          type: "PAYOUT_CLAWBACK",
          message: `Blind dropship refund obligation · ${label} · reimburse ${formatStoreCurrencyFromCents(amount)}`,
          orderId: null,
        },
      })
    }

    if (affiliateAmount > 0 && order.affiliatePayoutAt) {
      await recordMerchantPayoutEntry(tx, {
        blindDropshipOrderId: order.id,
        userId: order.affiliateId,
        beneficiaryRole: "AFFILIATE",
        amountCents: affiliateAmount,
        idempotencyKey: `clawback:blind:affiliate:${order.id}`,
        note: `Blind refund clawback · ${label}`,
        entryType: "CLAWBACK",
      })
      await tx.notification.create({
        data: {
          userId: order.affiliateId,
          type: "PAYOUT_CLAWBACK",
          message: `Blind dropship refund obligation · reimburse ${formatStoreCurrencyFromCents(affiliateAmount)}`,
          orderId: null,
        },
      })
    }
  })
}

export async function processDueBlindDropshipPayouts(limit = 100) {
  const candidates = await prisma.blindDropshipOrder.findMany({
    where: {
      status: "shipped",
      deliveredAt: { not: null },
      OR: [{ supplierPayoutAt: null }, { affiliatePayoutAt: null }],
    },
    orderBy: { deliveredAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let paid = 0
  let skipped = 0
  for (const { id } of candidates) {
    const r = await executeBlindDropshipMerchantPayout(id)
    if (r.ok) paid++
    else skipped++
  }
  return { processed: candidates.length, paid, skipped }
}
