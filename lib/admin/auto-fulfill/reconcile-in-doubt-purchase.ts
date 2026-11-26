import { SUPPLIER_PURCHASE_LOCK_PREFIX } from "@/lib/fulfillment/supplier-purchase-guard"
import { prisma } from "@/lib/prisma"

/**
 * The human way out of a purchase IN DOUBT (a `FulfillmentLog` stuck in BUYING).
 *
 * A BUYING claim never expires into a new purchase (`lib/fulfillment/supplier-purchase-guard.ts`): when the supplier's answer was
 * lost, only a person who has LOOKED at the AliExpress order list can say what happened. This is that person's tool — explicit,
 * serialised with the gate, and audited. It does not contact AliExpress and buys nothing.
 *
 *   - `exists`     : an AliExpress order exists (its id is required): recorded exactly as a normal purchase would have been —
 *                    `Order.supplierOrderId`, log BOUGHT. Every path then answers "already placed".
 *   - `not_exists` : nothing exists at AliExpress: the claim is released (log FAILED, trace kept). A later retry may buy.
 *
 * Takes the SAME per-order advisory lock as the gate, re-reads inside it, and only acts on a log that is still BUYING.
 * Audited in `AuditLog` (existing table, no migration): who, what, which AliExpress id, why.
 */

export type ReconcileInDoubtInput = {
  orderId: string
  outcome: "exists" | "not_exists"
  supplierOrderId?: string | null
  note?: string | null
  actorId: string
}

export type ReconcileInDoubtResult =
  | { ok: true; outcome: "exists" | "not_exists"; orderId: string; fulfillmentLogId: string }
  | { ok: false; error: string; status: number }

/** AliExpress order ids are numeric; the pattern is deliberately loose (digits / letters / - / _), but never a DRY_RUN id. */
const SUPPLIER_ORDER_ID = /^[A-Za-z0-9_-]{6,40}$/

export async function reconcileInDoubtPurchase(input: ReconcileInDoubtInput): Promise<ReconcileInDoubtResult> {
  const { orderId, outcome, actorId } = input
  const note = input.note?.trim().slice(0, 500) || null
  const supplierOrderId = input.supplierOrderId?.trim() || null

  if (outcome !== "exists" && outcome !== "not_exists") {
    return { ok: false, error: "invalid_outcome", status: 400 }
  }
  if (outcome === "exists") {
    if (!supplierOrderId || !SUPPLIER_ORDER_ID.test(supplierOrderId) || supplierOrderId.startsWith("DRY_RUN_")) {
      return { ok: false, error: "supplier_order_id_required", status: 400 }
    }
  }

  const result = await prisma.$transaction(
    async (tx): Promise<ReconcileInDoubtResult> => {
      // Same key as the purchase gate: no purchase can be claimed or settled for this order while we decide.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${SUPPLIER_PURCHASE_LOCK_PREFIX}${orderId}`}))`

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          supplierOrderId: true,
          autoBuyLog: { select: { id: true, status: true, aeOrderId: true } },
        },
      })
      if (!order) return { ok: false, error: "order_not_found", status: 404 }
      const log = order.autoBuyLog
      if (!log || log.status !== "BUYING") {
        return { ok: false, error: "not_in_doubt", status: 409 }
      }

      if (outcome === "exists") {
        if (order.supplierOrderId && order.supplierOrderId !== supplierOrderId) {
          return { ok: false, error: "order_has_another_supplier_order_id", status: 409 }
        }
        const now = new Date()
        await tx.fulfillmentLog.update({
          where: { id: log.id },
          data: { status: "BOUGHT", aeOrderId: supplierOrderId, errorMsg: null },
        })
        await tx.order.update({
          where: { id: orderId },
          data: {
            supplierOrderId,
            fulfillmentStatus: "ORDERED",
            // a refunded / cancelled order keeps its status: only the supplier reference is recorded
            ...(order.status === "paid" || order.status === "preparing"
              ? { status: "fulfilling", fulfilledAt: now, supplierPreparingAt: now }
              : {}),
          },
        })
      } else {
        await tx.fulfillmentLog.update({
          where: { id: log.id },
          data: {
            status: "FAILED",
            errorMsg: `RECONCILED_NOT_BOUGHT${note ? `:${note.slice(0, 200)}` : ""}`,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          action: "auto_buy.reconcile_in_doubt",
          entityType: "order",
          entityId: orderId,
          actorId,
          payload: {
            outcome,
            fulfillmentLogId: log.id,
            previousStatus: log.status,
            supplierOrderId: outcome === "exists" ? supplierOrderId : null,
            note,
          },
        },
      })

      return { ok: true, outcome, orderId, fulfillmentLogId: log.id }
    },
    { timeout: 15_000, maxWait: 15_000 }
  )

  if (result.ok) {
    console.log("[reconcile-in-doubt]", { orderId, outcome, actorId, fulfillmentLogId: result.fulfillmentLogId })
    if (outcome === "exists") {
      // As after a normal purchase: the supplier transfer may have been waiting for "upstream funded".
      try {
        const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
        triggerOrderTransferRelease(orderId)
      } catch (e) {
        console.error("[reconcile-in-doubt] transfer_release_trigger_failed", {
          orderId,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }
  return result
}
