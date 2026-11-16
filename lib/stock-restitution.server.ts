import "server-only"

import type { Prisma } from "@prisma/client"

import { planStockRestitution } from "@/lib/checkout-stock"
import { CLOSED_ORDER_STATUS_VALUES, CLOSED_SETTLEMENT_STATUS_VALUES } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import {
  buildStockReservedAuditRow,
  evaluateStockRestitution,
  parseStockReservationPayload,
  STOCK_RESERVED_ACTION,
  STOCK_RESTORED_ACTION,
  stockRestoredAuditId,
  type StockReservationPayload,
} from "@/lib/stock-restitution"

type Tx = Prisma.TransactionClient

/**
 * Inside the fulfilment transaction, right after `reserveStockInTransaction` answered `reserved` and the order exists:
 * records what was taken (see lib/stock-restitution.ts). `skipDuplicates` = `ON CONFLICT DO NOTHING`: a replay of the
 * same payment never aborts the transaction and never duplicates the marker.
 */
export async function writeStockReservationInTransaction(
  tx: Pick<Tx, "auditLog">,
  args: { orderId: string } & StockReservationPayload
): Promise<void> {
  const row = buildStockReservedAuditRow(args)
  await tx.auditLog.createMany({
    data: [{ ...row, payload: row.payload as Prisma.InputJsonObject }],
    skipDuplicates: true,
  })
}

type CandidateRow = { orderId: string; payload: unknown }

export type StockRestitutionOutcome =
  | "restored"
  | "already_done"
  | "order_open"
  | "order_shipped"
  | "supplier_purchase_exists"
  | "order_missing"
  | "product_missing"
  | "unreadable_marker"
  | "variant_row_gone"
  | "variant_row_ambiguous"
  | "not_variant_rows"
  | "invalid_quantity"
  | "error"

/**
 * Gives back the stock of closed, never-shipped orders (cron `restore-closed-order-stock`). Candidates = reservation
 * markers without a "restored" marker whose order is closed, oldest first. Each one runs in its own transaction:
 * product row locked (`FOR NO KEY UPDATE`, like the reservation), plan computed on the locked row, the "restored"
 * marker inserted (the idempotency point: a second run inserts nothing and writes nothing), then the stock.
 * A terminal refusal (shipped, bought from a supplier, variant row gone) also writes the marker, with the reason, so it is
 * not re-examined at every run; an order that is still open writes nothing.
 */
export async function restoreStockForClosedOrders(
  limit = 100
): Promise<Array<{ orderId: string; outcome: StockRestitutionOutcome; error?: string }>> {
  const candidates = await prisma.$queryRaw<CandidateRow[]>`
    SELECT a."entityId" AS "orderId", a."payload" AS "payload"
    FROM "AuditLog" a
    JOIN "Order" o ON o."id" = a."entityId"
    WHERE a."action" = ${STOCK_RESERVED_ACTION}
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" r WHERE r."id" = 'stock-restored:' || a."entityId")
      AND (lower(trim(o."status")) = ANY(${[...CLOSED_ORDER_STATUS_VALUES]})
        OR upper(trim(coalesce(o."paymentSettlementStatus", ''))) = ANY(${[...CLOSED_SETTLEMENT_STATUS_VALUES]}))
    ORDER BY a."createdAt" ASC
    LIMIT ${limit}`

  const results: Array<{ orderId: string; outcome: StockRestitutionOutcome; error?: string }> = []
  for (const candidate of candidates) {
    try {
      results.push({ orderId: candidate.orderId, outcome: await restoreOne(candidate) })
    } catch (error) {
      results.push({
        orderId: candidate.orderId,
        outcome: "error",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  for (const r of results) {
    console.log("[stock]", { result: "restitution", orderId: r.orderId, outcome: r.outcome, error: r.error })
  }
  return results
}

async function restoreOne(candidate: CandidateRow): Promise<StockRestitutionOutcome> {
  const marker = parseStockReservationPayload(candidate.payload)

  return prisma.$transaction(async (tx) => {
    const writeMarker = async (outcome: StockRestitutionOutcome, extra: Record<string, unknown> = {}) => {
      const inserted = await tx.auditLog.createMany({
        data: [
          {
            id: stockRestoredAuditId(candidate.orderId),
            action: STOCK_RESTORED_ACTION,
            entityType: "Order",
            entityId: candidate.orderId,
            payload: { outcome, ...extra } as Prisma.InputJsonObject,
          },
        ],
        skipDuplicates: true,
      })
      return inserted.count === 1
    }

    if (!marker) return (await writeMarker("unreadable_marker")) ? "unreadable_marker" : "already_done"

    const order = await tx.order.findUnique({
      where: { id: candidate.orderId },
      select: {
        status: true,
        paymentSettlementStatus: true,
        shippedAt: true,
        trackingNumber: true,
        supplierOrderId: true,
        fulfillmentStatus: true,
      },
    })
    if (!order) return "order_missing"
    const eligibility = evaluateStockRestitution({ ...order, fulfillmentStatus: String(order.fulfillmentStatus ?? "") })
    if (!eligibility.eligible) {
      if (eligibility.reason === "order_open") return "order_open"
      return (await writeMarker(eligibility.reason)) ? eligibility.reason : "already_done"
    }

    const rows = await tx.$queryRaw<Array<{ stock: number | null; variants: unknown }>>`
      SELECT "stock", "variants" FROM "Product" WHERE "id" = ${marker.productId} FOR NO KEY UPDATE`
    const product = rows[0]
    if (!product) return (await writeMarker("product_missing")) ? "product_missing" : "already_done"

    const variants = typeof product.variants === "string" ? safeJson(product.variants) : product.variants
    const plan = planStockRestitution({
      stock: product.stock,
      variants,
      scope: marker.scope,
      variantRowName: marker.variantRowName,
      qty: marker.qty,
    })
    if (plan.kind === "skip") return (await writeMarker(plan.reason)) ? plan.reason : "already_done"

    // The idempotency point: only the run that inserts the marker writes the stock (same transaction).
    if (!(await writeMarker("restored", { qty: marker.qty, scope: marker.scope, productId: marker.productId }))) {
      return "already_done"
    }
    if (plan.scope === "product") {
      await tx.product.update({ where: { id: marker.productId }, data: { stock: { increment: marker.qty } } })
    } else {
      await tx.product.update({
        where: { id: marker.productId },
        data: { stock: plan.nextStock, variants: plan.nextVariants as Prisma.InputJsonValue },
      })
    }
    return "restored"
  })
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}
