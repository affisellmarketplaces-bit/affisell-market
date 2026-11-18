import "server-only"
import type { Prisma } from "@prisma/client"
import { planStockRestitution } from "@/lib/checkout-stock"
import { prisma } from "@/lib/prisma"
import {
  canInspectReturn,
  planReturnRestock,
  resolveReturnRestockMode,
  RETURN_INSPECTION_ACTION,
  RETURN_RESTOCKED_ACTION,
  returnInspectionAuditId,
  returnRestockedAuditId,
  type ReturnInspectionOutcome,
} from "@/lib/return-disposition"
import { parseStockReservationPayload, stockReservedAuditId, stockRestoredAuditId } from "@/lib/stock-restitution"

export type InspectionResult =
  | {
      ok: true
      outcome: ReturnInspectionOutcome
      restock: "none" | "would_restock" | "restocked" | "skipped"
      reason?: string
      qty?: number
    }
  | { ok: false; error: "not_found" | "forbidden" | "not_received" | "already_restocked" }

/**
 * The supplier records what came back (step 2). The record is an AuditLog row (`return-inspection:<returnId>`, latest
 * outcome wins until a restock happened). Restocking (step 4) follows `planReturnRestock`: nothing unless
 * `RETURN_RESTOCK_MODE` says so; in `enforce` the units go back ONCE, under the product row lock, to the product or the
 * SAME variant row the sale took them from, and never if the closed-order restitution already gave them back.
 * The money (refund) is untouched.
 */
export async function recordReturnInspection(args: {
  returnId: string
  supplierId: string
  outcome: ReturnInspectionOutcome
  note: string
}): Promise<InspectionResult> {
  const ret = await prisma.orderReturn.findUnique({
    where: { id: args.returnId },
    select: { id: true, status: true, receivedAt: true, order: { select: { id: true, supplierId: true, quantity: true } } },
  })
  if (!ret) return { ok: false, error: "not_found" }
  if (ret.order.supplierId !== args.supplierId) return { ok: false, error: "forbidden" }
  if (!canInspectReturn(ret.status, ret.receivedAt)) return { ok: false, error: "not_received" }

  const orderId = ret.order.id
  const [restockedRow, restoredRow, reservationRow] = await Promise.all([
    prisma.auditLog.findUnique({ where: { id: returnRestockedAuditId(args.returnId) }, select: { id: true } }),
    prisma.auditLog.findUnique({ where: { id: stockRestoredAuditId(orderId) }, select: { payload: true } }),
    prisma.auditLog.findUnique({ where: { id: stockReservedAuditId(orderId) }, select: { payload: true } }),
  ])
  if (restockedRow) return { ok: false, error: "already_restocked" }

  const inspection = { outcome: args.outcome, note: args.note.slice(0, 1000), inspectedBy: args.supplierId }
  await prisma.auditLog.upsert({
    where: { id: returnInspectionAuditId(args.returnId) },
    create: {
      id: returnInspectionAuditId(args.returnId),
      action: RETURN_INSPECTION_ACTION,
      entityType: "OrderReturn",
      entityId: args.returnId,
      actorId: args.supplierId,
      payload: inspection,
    },
    update: { payload: inspection, actorId: args.supplierId },
  })

  const restoredBefore = (restoredRow?.payload as { outcome?: unknown } | null)?.outcome === "restored"
  const plan = planReturnRestock({
    mode: resolveReturnRestockMode(),
    outcome: args.outcome,
    returnedQty: ret.order.quantity ?? 1,
    alreadyRestocked: restoredBefore,
    reservation: parseStockReservationPayload(reservationRow?.payload ?? null),
  })
  if (plan.action === "none") return { ok: true, outcome: args.outcome, restock: "none", reason: plan.reason }
  if (plan.action === "would_restock") {
    console.log("[return-restock]", { returnId: args.returnId, result: "would_restock", qty: plan.qty })
    return { ok: true, outcome: args.outcome, restock: "would_restock", qty: plan.qty }
  }

  const reservation = plan.reservation
  const outcome = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ stock: number | null; variants: unknown }>>`
      SELECT "stock", "variants" FROM "Product" WHERE "id" = ${reservation.productId} FOR NO KEY UPDATE`
    const product = rows[0]
    if (!product) return { restock: "skipped" as const, reason: "product_missing" }
    const restitution = planStockRestitution({
      stock: product.stock,
      variants: product.variants,
      scope: reservation.scope,
      variantRowName: reservation.variantRowName,
      qty: plan.qty,
    })
    if (restitution.kind === "skip") return { restock: "skipped" as const, reason: restitution.reason }
    // Idempotency point: only the run that inserts the marker writes the stock.
    const inserted = await tx.auditLog.createMany({
      data: [
        {
          id: returnRestockedAuditId(args.returnId),
          action: RETURN_RESTOCKED_ACTION,
          entityType: "OrderReturn",
          entityId: args.returnId,
          actorId: args.supplierId,
          payload: { qty: plan.qty, productId: reservation.productId, scope: restitution.scope } as Prisma.InputJsonObject,
        },
      ],
      skipDuplicates: true,
    })
    if (inserted.count !== 1) return { restock: "skipped" as const, reason: "already_restocked" }
    await tx.product.update({
      where: { id: reservation.productId },
      data:
        restitution.scope === "product"
          ? { stock: { increment: plan.qty } }
          : { stock: restitution.nextStock, variants: restitution.nextVariants as Prisma.InputJsonValue },
    })
    return { restock: "restocked" as const }
  })
  return { ok: true, outcome: args.outcome, qty: plan.qty, ...outcome }
}
