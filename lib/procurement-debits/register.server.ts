import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { isPrismaSchemaMissingError } from "@/lib/prisma-schema-error"
import {
  checkAllocation,
  movementBalances,
  reconcileOrderCost,
  type AllocationRequest,
  type AllocationRow,
  type DebitInput,
  type MovementRow,
  type OrderCostReconciliation,
} from "@/lib/procurement-debits/register"

/**
 * Writes and reads of the procurement debit register (rules: register.ts). ADMIN only (the routes check it); every
 * write is a person's action, traced twice: in the row itself (who / when) and in `AuditLog` (`procurement_debit.*`).
 * Nothing here pays, refunds or transfers anything, and nothing here changes an order: the register only RECORDS
 * movements read from a source and the orders they belong to.
 * A database without the migration answers `register_unavailable` (reads: `available: false`), never a crash.
 */
export const REGISTER_AUDIT = {
  recorded: "procurement_debit.recorded",
  voided: "procurement_debit.voided",
  allocated: "procurement_debit.allocated",
  revoked: "procurement_debit.allocation_revoked",
} as const

type Tx = Prisma.TransactionClient

const toMovement = (r: {
  id: string
  kind: string
  source: string
  sourceReference: string
  status: string
  amountCents: number
  currency: string
  settledAmountCents: number | null
  parentDebitId: string | null
  includesDelivery: boolean | null
  vatTreatment: string
  occurredAt: Date
}): MovementRow => ({
  id: r.id,
  kind: r.kind as MovementRow["kind"],
  source: r.source,
  sourceReference: r.sourceReference,
  status: r.status === "voided" ? "voided" : "recorded",
  amountCents: r.amountCents,
  currency: r.currency,
  settledAmountCents: r.settledAmountCents,
  parentDebitId: r.parentDebitId,
  includesDelivery: r.includesDelivery,
  vatTreatment: (["included", "excluded"].includes(r.vatTreatment) ? r.vatTreatment : "unknown") as MovementRow["vatTreatment"],
  occurredAt: r.occurredAt.toISOString(),
})
const toAllocation = (a: { id: string; debitId: string; orderId: string; amountCents: number; status: string }): AllocationRow => ({
  id: a.id,
  debitId: a.debitId,
  orderId: a.orderId,
  amountCents: a.amountCents,
  status: a.status === "active" ? "active" : "revoked",
})

const MOVEMENT_SELECT = {
  id: true,
  kind: true,
  source: true,
  sourceReference: true,
  status: true,
  amountCents: true,
  currency: true,
  settledAmountCents: true,
  parentDebitId: true,
  includesDelivery: true,
  vatTreatment: true,
  occurredAt: true,
} as const

function unavailable(e: unknown): boolean {
  return isPrismaSchemaMissingError(e)
}

export type RecordResult =
  | { ok: true; id: string }
  | { ok: false; error: "already_recorded"; existingId: string }
  | { ok: false; error: "parent_not_found" | "parent_not_a_debit" | "parent_voided" | "register_unavailable" }

/** Records one movement. The same (source, reference) twice = `already_recorded` with the existing id, nothing written. */
export async function recordProcurementDebit(input: DebitInput, actorId: string): Promise<RecordResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.procurementDebit.findUnique({
        where: { source_sourceReference: { source: input.source, sourceReference: input.sourceReference } },
        select: { id: true },
      })
      if (existing) return { ok: false as const, error: "already_recorded" as const, existingId: existing.id }
      if (input.parentDebitId) {
        const parent = await tx.procurementDebit.findUnique({ where: { id: input.parentDebitId }, select: { kind: true, status: true } })
        if (!parent) return { ok: false as const, error: "parent_not_found" as const }
        if (parent.kind !== "debit") return { ok: false as const, error: "parent_not_a_debit" as const }
        if (parent.status !== "recorded") return { ok: false as const, error: "parent_voided" as const }
      }
      const row = await tx.procurementDebit.create({
        data: {
          kind: input.kind,
          source: input.source,
          sourceReference: input.sourceReference,
          amountCents: input.amountCents,
          currency: input.currency,
          settledAmountCents: input.settledAmountCents,
          settledCurrency: input.settledAmountCents == null ? null : "EUR",
          occurredAt: new Date(input.occurredAt),
          parentDebitId: input.parentDebitId,
          includesDelivery: input.includesDelivery,
          vatTreatment: input.vatTreatment,
          evidence: input.evidence as unknown as Prisma.InputJsonValue,
          note: input.note,
          recordedById: actorId,
        },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          action: REGISTER_AUDIT.recorded,
          entityType: "ProcurementDebit",
          entityId: row.id,
          actorId,
          payload: { kind: input.kind, source: input.source, amountCents: input.amountCents, currency: input.currency, settledAmountCents: input.settledAmountCents },
        },
      })
      return { ok: true as const, id: row.id }
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.procurementDebit.findUnique({
        where: { source_sourceReference: { source: input.source, sourceReference: input.sourceReference } },
        select: { id: true },
      })
      if (again) return { ok: false, error: "already_recorded", existingId: again.id }
    }
    if (unavailable(e)) return { ok: false, error: "register_unavailable" }
    throw e
  }
}

/** Lock a movement row (and nothing else). */
async function lockMovement(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "ProcurementDebit" WHERE "id" = ${id} FOR UPDATE`
}

export type AllocateResult =
  | { ok: true; id: string; remainingAfterCents: number }
  | { ok: false; error: string; remainingCents?: number }

/**
 * Allocates (part of) a movement to an order. Locks the parent debit first, then the movement (always that order, so
 * two refunds of one debit are checked one after the other), re-reads everything inside the lock, applies
 * `checkAllocation`; the database trigger checks the over-allocation again.
 */
export async function allocateProcurementDebit(debitId: string, request: AllocationRequest, actorId: string): Promise<AllocateResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const head = await tx.procurementDebit.findUnique({ where: { id: debitId }, select: { parentDebitId: true } })
      if (!head) return { ok: false as const, error: "not_found" }
      if (head.parentDebitId) await lockMovement(tx, head.parentDebitId)
      await lockMovement(tx, debitId)
      const order = await tx.order.findUnique({ where: { id: request.orderId }, select: { id: true } })
      if (!order) return { ok: false as const, error: "order_not_found" }
      const movement = await tx.procurementDebit.findUnique({ where: { id: debitId }, select: MOVEMENT_SELECT })
      if (!movement) return { ok: false as const, error: "not_found" }
      const parent = movement.parentDebitId
        ? await tx.procurementDebit.findUnique({ where: { id: movement.parentDebitId }, select: MOVEMENT_SELECT })
        : null
      const siblings = movement.parentDebitId
        ? await tx.procurementDebit.findMany({ where: { parentDebitId: movement.parentDebitId }, select: MOVEMENT_SELECT })
        : []
      const ids = [movement.id, ...(parent ? [parent.id] : []), ...siblings.map((s) => s.id)]
      const allocations = await tx.procurementDebitAllocation.findMany({
        where: { debitId: { in: ids }, status: "active" },
        select: { id: true, debitId: true, orderId: true, amountCents: true, status: true },
      })
      const check = checkAllocation({
        movement: toMovement(movement),
        parent: parent ? toMovement(parent) : null,
        allocations: allocations.map(toAllocation),
        siblings: siblings.map(toMovement),
        request,
      })
      if (!check.ok) return { ok: false as const, error: check.error, remainingCents: check.remainingCents }
      const row = await tx.procurementDebitAllocation.create({
        data: { debitId, orderId: request.orderId, amountCents: request.amountCents, basis: request.basis, note: request.note, allocatedById: actorId },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          action: REGISTER_AUDIT.allocated,
          entityType: "ProcurementDebit",
          entityId: debitId,
          actorId,
          payload: { allocationId: row.id, orderId: request.orderId, amountCents: request.amountCents, basis: request.basis },
        },
      })
      return { ok: true as const, id: row.id, remainingAfterCents: check.remainingAfterCents }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/procurement_debit_over_allocated/.test(msg)) return { ok: false, error: "over_allocated" }
    if (/procurement_debit_not_allocatable/.test(msg)) return { ok: false, error: "movement_voided" }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "already_allocated_to_order" }
    if (unavailable(e)) return { ok: false, error: "register_unavailable" }
    throw e
  }
}

/** Revokes one allocation (with a reason). The movement's amount becomes allocatable again. */
export async function revokeProcurementAllocation(allocationId: string, reason: string, actorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const a = await tx.procurementDebitAllocation.findUnique({ where: { id: allocationId }, select: { id: true, debitId: true, orderId: true, status: true } })
      if (!a) return { ok: false as const, error: "not_found" }
      await lockMovement(tx, a.debitId)
      const done = await tx.procurementDebitAllocation.updateMany({
        where: { id: allocationId, status: "active" },
        data: { status: "revoked", revokedAt: new Date(), revokedById: actorId, revokeReason: reason },
      })
      if (done.count === 0) return { ok: false as const, error: "already_revoked" }
      await tx.auditLog.create({
        data: { action: REGISTER_AUDIT.revoked, entityType: "ProcurementDebit", entityId: a.debitId, actorId, payload: { allocationId, orderId: a.orderId, reason } },
      })
      return { ok: true as const }
    })
  } catch (e) {
    if (unavailable(e)) return { ok: false, error: "register_unavailable" }
    throw e
  }
}

/**
 * Voids a movement recorded by mistake (with a reason): its active allocations are revoked in the same transaction.
 * Refused while a recorded refund / fee still points at it (void those first) — a refund never outlives its debit.
 */
export async function voidProcurementDebit(id: string, reason: string, actorId: string): Promise<{ ok: true; revokedAllocations: number } | { ok: false; error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockMovement(tx, id)
      const m = await tx.procurementDebit.findUnique({ where: { id }, select: { status: true } })
      if (!m) return { ok: false as const, error: "not_found" }
      if (m.status !== "recorded") return { ok: false as const, error: "already_voided" }
      const children = await tx.procurementDebit.count({ where: { parentDebitId: id, status: "recorded" } })
      if (children > 0) return { ok: false as const, error: "has_recorded_children" }
      const now = new Date()
      const revoked = await tx.procurementDebitAllocation.updateMany({
        where: { debitId: id, status: "active" },
        data: { status: "revoked", revokedAt: now, revokedById: actorId, revokeReason: `mouvement annulé : ${reason}`.slice(0, 500) },
      })
      await tx.procurementDebit.update({ where: { id }, data: { status: "voided", voidReason: reason, voidedAt: now, voidedById: actorId } })
      await tx.auditLog.create({
        data: { action: REGISTER_AUDIT.voided, entityType: "ProcurementDebit", entityId: id, actorId, payload: { reason, revokedAllocations: revoked.count } },
      })
      return { ok: true as const, revokedAllocations: revoked.count }
    })
  } catch (e) {
    if (unavailable(e)) return { ok: false, error: "register_unavailable" }
    throw e
  }
}

/**
 * Reconciliation of a set of orders (read-only). Reads every movement allocated to them, their parents and children,
 * and ALL active allocations of those movements (other orders included).
 */
export async function loadOrderCostReconciliations(
  orders: ReadonlyArray<{ id: string; storedSourcePriceCents: number | null }>
): Promise<{ available: true; byOrder: Map<string, OrderCostReconciliation> } | { available: false }> {
  const byOrder = new Map<string, OrderCostReconciliation>()
  if (orders.length === 0) return { available: true, byOrder }
  try {
    const mine = await prisma.procurementDebitAllocation.findMany({
      where: { orderId: { in: orders.map((o) => o.id) }, status: "active" },
      select: { debitId: true },
    })
    let ids = [...new Set(mine.map((a) => a.debitId))]
    const first = ids.length ? await prisma.procurementDebit.findMany({ where: { id: { in: ids } }, select: MOVEMENT_SELECT }) : []
    const parentIds = first.map((m) => m.parentDebitId).filter((x): x is string => !!x)
    const debitIds = [...new Set([...first.filter((m) => m.kind === "debit").map((m) => m.id), ...parentIds])]
    const related = debitIds.length
      ? await prisma.procurementDebit.findMany({ where: { OR: [{ id: { in: debitIds } }, { parentDebitId: { in: debitIds } }] }, select: MOVEMENT_SELECT })
      : []
    const movements = new Map([...first, ...related].map((m) => [m.id, toMovement(m)]))
    ids = [...movements.keys()]
    const allocations = ids.length
      ? (
          await prisma.procurementDebitAllocation.findMany({
            where: { debitId: { in: ids }, status: "active" },
            select: { id: true, debitId: true, orderId: true, amountCents: true, status: true },
          })
        ).map(toAllocation)
      : []
    for (const o of orders) {
      byOrder.set(o.id, reconcileOrderCost({ orderId: o.id, storedSourcePriceCents: o.storedSourcePriceCents, movements: [...movements.values()], allocations }))
    }
    return { available: true, byOrder }
  } catch (e) {
    if (unavailable(e)) return { available: false }
    throw e
  }
}

/** One order's reconciliation, with its stored price read from the order (admin view). */
export async function loadOrderProcurementCost(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, aeWholesaleCents: true, usesAffisellAutoBuy: true, quantity: true, paidAt: true },
  })
  if (!order) return null
  const res = await loadOrderCostReconciliations([{ id: order.id, storedSourcePriceCents: order.aeWholesaleCents ?? null }])
  if (!res.available) return { available: false as const, orderId }
  return { available: true as const, order: { id: order.id, usesAffisellAutoBuy: order.usesAffisellAutoBuy, quantity: order.quantity }, reconciliation: res.byOrder.get(order.id)! }
}

/** Latest movements with their allocation balance (admin list). */
export async function listProcurementDebits(take = 100) {
  try {
    const rows = await prisma.procurementDebit.findMany({
      orderBy: { occurredAt: "desc" },
      take: Math.min(Math.max(take, 1), 500),
      select: { ...MOVEMENT_SELECT, note: true, evidence: true, recordedById: true, createdAt: true, voidReason: true },
    })
    const allocations = rows.length
      ? await prisma.procurementDebitAllocation.findMany({
          where: { debitId: { in: rows.map((r) => r.id) } },
          select: { id: true, debitId: true, orderId: true, amountCents: true, status: true, basis: true, note: true, createdAt: true, revokeReason: true },
          orderBy: { createdAt: "asc" },
        })
      : []
    const balances = new Map(movementBalances(rows.map(toMovement), allocations.map(toAllocation)).map((b) => [b.id, b]))
    return {
      available: true as const,
      movements: rows.map((r) => ({
        ...toMovement(r),
        note: r.note,
        evidence: r.evidence,
        voidReason: r.voidReason,
        recordedAt: r.createdAt.toISOString(),
        balance: balances.get(r.id)!,
        allocations: allocations.filter((a) => a.debitId === r.id).map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      })),
    }
  } catch (e) {
    if (unavailable(e)) return { available: false as const, movements: [] }
    throw e
  }
}
