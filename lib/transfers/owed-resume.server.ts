import "server-only"
import type { Prisma } from "@prisma/client"

import { AFFISELL_AUTOBUY_SUPPLIER_EMAIL } from "@/lib/auto-buy-platform-supplier-shared"
import { computeTransferAmountsFromOrder, orderSplitInputFromOrder } from "@/lib/marketplace-split-amounts"
import { computeOrderEscrowAllocation, resolveOrderEscrowAllocation } from "@/lib/order-escrow-allocation"
import { DISPUTE_HOLD_ID_PREFIX, DISPUTE_HOLD_STATUS } from "@/lib/orders/dispute-hold.server"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import {
  OWED_RESUME_AUDIT_ACTION,
  planOrderResume,
  resolveOwedResumeMode,
  summarizeResume,
  type ResumeLegPlan,
  type ResumeOrderFacts,
} from "@/lib/transfers/owed-resume"

const MAX_ORDERS = 5_000

const ORDER_INCLUDE = {
  supplier: { select: { id: true, email: true, stripeAccountId: true } },
  affiliate: { select: { id: true, stripeAccountId: true } },
  transferAttempts: { select: { role: true } },
  stripeRefunds: { select: { amountCents: true } },
} satisfies Prisma.OrderInclude

type OrderWithFacts = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>

/** The legs the settlement plans for one order — SAME functions as `scheduleMarketplaceTransferAttempts`. */
function factsForOrder(order: OrderWithFacts, disputeOpen: boolean): ResumeOrderFacts {
  const amounts = computeTransferAmountsFromOrder(orderSplitInputFromOrder(order, { firstSchedule: false }))
  const escrow =
    order.supplierMarginCents != null
      ? resolveOrderEscrowAllocation(order)
      : computeOrderEscrowAllocation({
          usesAffisellAutoBuy: order.usesAffisellAutoBuy,
          aeWholesaleCents: order.aeWholesaleCents,
          supplierPayoutCents: amounts.supplierPayoutCents,
        })
  const roles = new Set(order.transferAttempts.map((a) => a.role))
  const affiliateDestination = order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim() || null
  return {
    orderId: order.id,
    paidAt: order.paidAt,
    closed: isOrderClosedForPayout(order),
    disputeOpen,
    refundedCents: order.stripeRefunds.reduce((s, r) => s + Math.max(0, r.amountCents), 0),
    supplierIsPlatform: order.supplier.email === AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
    legs: [
      {
        role: "SUPPLIER",
        partnerId: order.supplierId,
        plannedCents: amounts.supplierPayoutCents > 0 ? escrow.supplierMarginCents : 0,
        destination: order.supplier.stripeAccountId?.trim() || null,
        hasAttempt: roles.has("SUPPLIER"),
      },
      ...(order.affiliateId
        ? [
            {
              role: "AFFILIATE" as const,
              partnerId: order.affiliateId,
              plannedCents: amounts.affiliateTransferCents,
              destination: affiliateDestination,
              hasAttempt: roles.has("AFFILIATE"),
            },
          ]
        : []),
    ],
  }
}

async function openDisputeOrderIds(db: Prisma.TransactionClient | typeof prisma, orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set()
  const rows = await db.processedWebhook.findMany({
    where: { orderId: { in: orderIds }, id: { startsWith: DISPUTE_HOLD_ID_PREFIX }, status: DISPUTE_HOLD_STATUS.open },
    select: { orderId: true },
  })
  return new Set(rows.map((r) => r.orderId).filter((id): id is string => Boolean(id)))
}

/**
 * READ-ONLY: what a resume would do for every paid order of the last `days` days. Writes nothing, calls no Stripe.
 */
export async function planOwedTransferResume(days = 180) {
  const since = new Date(Date.now() - Math.max(1, days) * 86_400_000)
  const orders = await prisma.order.findMany({
    where: { paidAt: { gte: since } },
    orderBy: { paidAt: "desc" },
    take: MAX_ORDERS + 1,
    include: ORDER_INCLUDE,
  })
  const truncated = orders.length > MAX_ORDERS
  const kept = orders.slice(0, MAX_ORDERS)
  const disputed = await openDisputeOrderIds(prisma, kept.map((o) => o.id))
  const plans = kept.flatMap((o) => planOrderResume(factsForOrder(o, disputed.has(o.id))))
  const relevant = plans.filter((p) => p.decision !== "nothing_owed" && p.decision !== "platform_account")
  return {
    mode: resolveOwedResumeMode(),
    windowDays: days,
    ordersRead: kept.length,
    truncated,
    summary: summarizeResume(plans),
    legs: relevant.filter((p) => p.decision !== "already_scheduled").slice(0, 500),
    note:
      "Simulation — rien n'est écrit ni versé. « create » = un virement EN ATTENTE serait créé, puis payé par le cron process-transfers. Commandes partiellement remboursées et litiges ouverts : jamais automatiques.",
  }
}

export type ApplyOutcome =
  | { ok: false; error: "mode_off" }
  | { ok: true; created: Array<{ orderId: string; role: string; amountCents: number }>; skipped: ResumeLegPlan[] }

/**
 * Creates the PENDING transfer rows of resumable legs — ONLY when `OWED_TRANSFER_RESUME_MODE=enforce` (founder decision;
 * default `off`). Each order is re-read and re-planned INSIDE its own transaction (row lock), so the amount and the
 * eligibility are today's, never the plan's. `createMany({ skipDuplicates })` on the (orderId, role) unique key + a
 * deterministic AuditLog id = idempotent. Calls no Stripe: the existing `process-transfers` cron pays the rows.
 */
export async function applyOwedTransferResume(args: { adminId: string; orderIds: string[] }): Promise<ApplyOutcome> {
  if (resolveOwedResumeMode() !== "enforce") return { ok: false, error: "mode_off" }
  const created: Array<{ orderId: string; role: string; amountCents: number }> = []
  const skipped: ResumeLegPlan[] = []
  for (const orderId of [...new Set(args.orderIds)].slice(0, 200)) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`
      const order = await tx.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE })
      if (!order || !order.paidAt) return
      const disputed = await openDisputeOrderIds(tx, [orderId])
      for (const plan of planOrderResume(factsForOrder(order, disputed.has(orderId)))) {
        if (plan.decision !== "create" || !plan.destination) {
          if (plan.decision !== "nothing_owed" && plan.decision !== "platform_account") skipped.push(plan)
          continue
        }
        const inserted = await tx.transferAttempt.createMany({
          data: [{ orderId, role: plan.role, amountCents: plan.amountCents, destination: plan.destination, status: "PENDING" }],
          skipDuplicates: true,
        })
        if (inserted.count !== 1) {
          skipped.push({ ...plan, decision: "already_scheduled" })
          continue
        }
        await tx.auditLog.createMany({
          data: [
            {
              id: plan.idempotencyKey,
              action: OWED_RESUME_AUDIT_ACTION,
              entityType: "Order",
              entityId: orderId,
              actorId: args.adminId,
              payload: { role: plan.role, partnerId: plan.partnerId, amountCents: plan.amountCents },
            },
          ],
          skipDuplicates: true,
        })
        created.push({ orderId, role: plan.role, amountCents: plan.amountCents })
      }
    })
  }
  return { ok: true, created, skipped }
}
