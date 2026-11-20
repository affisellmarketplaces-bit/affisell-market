import "server-only"
import type { Prisma } from "@prisma/client"
import { planStockRestitution } from "@/lib/checkout-stock"
import { prisma } from "@/lib/prisma"
import {
  canDecideRestock,
  canInspectReturn,
  dispositionStage,
  isReturnDecision,
  isReturnInspectionOutcome,
  planReturnRestock,
  RETURN_DECISION_ACTION,
  returnDecisionId,
  returnInspectionHistoryId,
  type DispositionEvent,
  type ReturnDecision,
  resolveReturnRestockMode,
  RETURN_INSPECTION_ACTION,
  RETURN_RESTOCKED_ACTION,
  returnInspectionAuditId,
  returnRestockedAuditId,
  type ReturnInspectionOutcome,
} from "@/lib/return-disposition"
import { parseStockReservationPayload, stockReservedAuditId, stockRestoredAuditId } from "@/lib/stock-restitution"

export type InspectionResult =
  | { ok: true; outcome: ReturnInspectionOutcome; inspection: number }
  | { ok: false; error: "not_found" | "forbidden" | "not_received" | "already_restocked" }

export type DecisionResult =
  | {
      ok: true
      decision: ReturnDecision
      restock: "none" | "would_restock" | "restocked" | "skipped"
      reason?: string
      qty?: number
    }
  | { ok: false; error: "not_found" | "forbidden" | "not_received" | "already_restocked" | "not_inspected" | "not_resellable" }

type LoadedReturn =
  | { error: "not_found" | "forbidden" | "not_received" }
  | { error?: undefined; ret: { id: string; status: string; receivedAt: Date | null; order: { id: string; supplierId: string; quantity: number } } }

async function loadReturnForSupplier(returnId: string, supplierId: string): Promise<LoadedReturn> {
  const ret = await prisma.orderReturn.findUnique({
    where: { id: returnId },
    select: { id: true, status: true, receivedAt: true, order: { select: { id: true, supplierId: true, quantity: true } } },
  })
  if (!ret) return { error: "not_found" as const }
  if (ret.order.supplierId !== supplierId) return { error: "forbidden" as const }
  if (!canInspectReturn(ret.status, ret.receivedAt)) return { error: "not_received" as const }
  return { ret }
}

/**
 * Step 2 — the supplier records what came back (the OBSERVED state). Never touches stock. Each inspection is kept
 * (`return-inspection:<returnId>:<n>`); the latest one is also mirrored at `return-inspection:<returnId>`. Refused
 * once the goods were restocked (the record would no longer describe what is on the shelf).
 */
export async function recordReturnInspection(args: {
  returnId: string
  supplierId: string
  outcome: ReturnInspectionOutcome
  note: string
}): Promise<InspectionResult> {
  const loaded = await loadReturnForSupplier(args.returnId, args.supplierId)
  if (loaded.error !== undefined) return { ok: false, error: loaded.error }
  const restocked = await prisma.auditLog.findUnique({ where: { id: returnRestockedAuditId(args.returnId) }, select: { id: true } })
  if (restocked) return { ok: false, error: "already_restocked" }

  const inspection = { outcome: args.outcome, note: args.note.slice(0, 1000), inspectedBy: args.supplierId }
  const n =
    (await prisma.auditLog.count({ where: { action: RETURN_INSPECTION_ACTION, entityId: args.returnId, NOT: { id: returnInspectionAuditId(args.returnId) } } })) + 1
  await prisma.auditLog.createMany({
    data: [
      {
        id: returnInspectionHistoryId(args.returnId, n),
        action: RETURN_INSPECTION_ACTION,
        entityType: "OrderReturn",
        entityId: args.returnId,
        actorId: args.supplierId,
        payload: { ...inspection, n },
      },
    ],
    skipDuplicates: true,
  })
  await prisma.auditLog.upsert({
    where: { id: returnInspectionAuditId(args.returnId) },
    create: {
      id: returnInspectionAuditId(args.returnId),
      action: RETURN_INSPECTION_ACTION,
      entityType: "OrderReturn",
      entityId: args.returnId,
      actorId: args.supplierId,
      payload: { ...inspection, n, latest: true },
    },
    update: { payload: { ...inspection, n, latest: true }, actorId: args.supplierId },
  })
  return { ok: true, outcome: args.outcome, inspection: n }
}

/**
 * Step 3/4 — the supplier VALIDATES what to do with the goods, on the latest inspection. `keep_out` only records.
 * `restock` needs a `resellable` latest inspection; it is recorded, then the units go back only per
 * `RETURN_RESTOCK_MODE` (`off` default: nothing; `observe`: logged; `enforce`: ONCE, under the product row lock, to the
 * product or the SAME variant row the sale took them from, never if the closed-order restitution already gave them
 * back). Every decision is a row (`return-decision:<returnId>:<n>`). The money (refund) is untouched.
 */
export async function decideReturnDisposition(args: {
  returnId: string
  supplierId: string
  decision: ReturnDecision
  note: string
}): Promise<DecisionResult> {
  const loaded = await loadReturnForSupplier(args.returnId, args.supplierId)
  if (loaded.error !== undefined) return { ok: false, error: loaded.error }
  const ret = loaded.ret
  const orderId = ret.order.id
  const [latestRow, restockedRow, restoredRow, reservationRow] = await Promise.all([
    prisma.auditLog.findUnique({ where: { id: returnInspectionAuditId(args.returnId) }, select: { payload: true } }),
    prisma.auditLog.findUnique({ where: { id: returnRestockedAuditId(args.returnId) }, select: { id: true } }),
    prisma.auditLog.findUnique({ where: { id: stockRestoredAuditId(orderId) }, select: { payload: true } }),
    prisma.auditLog.findUnique({ where: { id: stockReservedAuditId(orderId) }, select: { payload: true } }),
  ])
  if (restockedRow) return { ok: false, error: "already_restocked" }
  const latestOutcome = (latestRow?.payload as { outcome?: unknown } | null)?.outcome
  const latest = isReturnInspectionOutcome(latestOutcome) ? latestOutcome : null
  if (!latest) return { ok: false, error: "not_inspected" }
  if (!canDecideRestock(latest, args.decision)) return { ok: false, error: "not_resellable" }

  const restoredBefore = (restoredRow?.payload as { outcome?: unknown } | null)?.outcome === "restored"
  const plan =
    args.decision === "restock"
      ? planReturnRestock({
          mode: resolveReturnRestockMode(),
          outcome: latest,
          returnedQty: ret.order.quantity ?? 1,
          alreadyRestocked: restoredBefore,
          reservation: parseStockReservationPayload(reservationRow?.payload ?? null),
        })
      : null
  const restockLabel = !plan ? "none" : plan.action === "none" ? `none:${plan.reason}` : plan.action

  const n = (await prisma.auditLog.count({ where: { action: RETURN_DECISION_ACTION, entityId: args.returnId } })) + 1
  await prisma.auditLog.createMany({
    data: [
      {
        id: returnDecisionId(args.returnId, n),
        action: RETURN_DECISION_ACTION,
        entityType: "OrderReturn",
        entityId: args.returnId,
        actorId: args.supplierId,
        payload: { decision: args.decision, note: args.note.slice(0, 1000), onInspection: latest, restock: restockLabel, n },
      },
    ],
    skipDuplicates: true,
  })

  if (!plan) return { ok: true, decision: args.decision, restock: "none" }
  if (plan.action === "none") return { ok: true, decision: args.decision, restock: "none", reason: plan.reason }
  if (plan.action === "would_restock") {
    console.log("[return-restock]", { returnId: args.returnId, result: "would_restock", qty: plan.qty })
    return { ok: true, decision: args.decision, restock: "would_restock", qty: plan.qty }
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
          payload: { qty: plan.qty, productId: reservation.productId, scope: restitution.scope, decision: n } as Prisma.InputJsonObject,
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
  return { ok: true, decision: args.decision, qty: plan.qty, ...outcome }
}

/** The traced steps of one return's goods, oldest first, for its supplier. Read-only. */
export async function loadReturnDispositionTimeline(returnId: string, supplierId: string) {
  const ret = await prisma.orderReturn.findUnique({
    where: { id: returnId },
    select: { id: true, receivedAt: true, order: { select: { supplierId: true } } },
  })
  if (!ret || ret.order.supplierId !== supplierId) return null
  const rows = await prisma.auditLog.findMany({
    where: {
      entityId: returnId,
      action: { in: [RETURN_INSPECTION_ACTION, RETURN_DECISION_ACTION, RETURN_RESTOCKED_ACTION] },
      NOT: { id: returnInspectionAuditId(returnId) },
    },
    orderBy: { createdAt: "asc" },
    select: { action: true, createdAt: true, payload: true },
  })
  const events: DispositionEvent[] = []
  if (ret.receivedAt) events.push({ kind: "received", at: ret.receivedAt.toISOString() })
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>
    const at = r.createdAt.toISOString()
    if (r.action === RETURN_INSPECTION_ACTION && isReturnInspectionOutcome(p.outcome)) {
      events.push({ kind: "inspected", at, outcome: p.outcome, note: typeof p.note === "string" ? p.note : "" })
    } else if (r.action === RETURN_DECISION_ACTION && isReturnDecision(p.decision)) {
      events.push({ kind: "decided", at, decision: p.decision, note: typeof p.note === "string" ? p.note : "", restock: String(p.restock ?? "") })
    } else if (r.action === RETURN_RESTOCKED_ACTION) {
      events.push({ kind: "restocked", at, qty: Number(p.qty) || 0 })
    }
  }
  return { events, stage: dispositionStage(events), restockMode: resolveReturnRestockMode() }
}
