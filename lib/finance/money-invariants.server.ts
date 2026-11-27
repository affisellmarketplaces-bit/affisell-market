import type { OrderMoneySnapshot } from "@/lib/finance/money-invariants"

/**
 * Reads what `evaluateOrderMoneyInvariants` needs, SELECT only (the report also opens a server-enforced read-only
 * session, so a write is impossible even if this file changed). Orders that touched money (an attempt or a ledger row)
 * created since `since`, keyset-paginated by id.
 */
export const MONEY_INVARIANTS_SQL = {
  orders: `SELECT o."id", o."status", o."paymentSettlementStatus"::text AS "paymentSettlementStatus", o."payoutStatus",
       o."totalCents", o."subtotalCents", o."taxCents", o."sellingPriceCents"
  FROM "Order" o
 WHERE o."createdAt" >= $1 AND o."id" > $2
   AND (EXISTS (SELECT 1 FROM "TransferAttempt" t WHERE t."orderId" = o."id")
     OR EXISTS (SELECT 1 FROM "MerchantPayoutLedger" l WHERE l."orderId" = o."id"))
 ORDER BY o."id"
 LIMIT $3`,
  attempts: `SELECT "orderId", "role"::text AS "role", "amountCents", "status"::text AS "status", "stripeTransferId"
  FROM "TransferAttempt" WHERE "orderId" = ANY($1::text[])`,
  ledger: `SELECT "orderId", "beneficiaryRole", "entryType", "amountCents", "stripeTransferId", "payoutRail", "createdAt"
  FROM "MerchantPayoutLedger" WHERE "orderId" = ANY($1::text[])`,
  refunds: `SELECT "orderId", "amountCents" FROM "OrderStripeRefund" WHERE "orderId" = ANY($1::text[])`,
  disputes: `SELECT "orderId", "status", "createdAt" FROM "ProcessedWebhook"
 WHERE "id" LIKE 'dispute:%' AND "orderId" = ANY($1::text[])`,
} as const

export type RawQueryable = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> }

type OrderRow = Omit<OrderMoneySnapshot, "orderId" | "refunds" | "attempts" | "ledger" | "disputes"> & { id: string }
type WithOrder<T> = T & { orderId: string }

const num = (v: unknown): number => (typeof v === "bigint" ? Number(v) : Number(v ?? 0))
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v))

function groupBy<T extends { orderId: string }>(rows: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) m.set(r.orderId, [...(m.get(r.orderId) ?? []), r])
  return m
}

/** One page of snapshots; `nextAfterId` is null when there is nothing more. */
export async function loadOrderMoneySnapshots(
  db: RawQueryable,
  args: { since: Date; afterId?: string; limit?: number },
): Promise<{ snapshots: OrderMoneySnapshot[]; nextAfterId: string | null }> {
  const limit = Math.min(Math.max(args.limit ?? 500, 1), 2_000)
  const orders = await db.$queryRawUnsafe<OrderRow[]>(
    MONEY_INVARIANTS_SQL.orders,
    args.since,
    args.afterId ?? "",
    limit,
  )
  if (orders.length === 0) return { snapshots: [], nextAfterId: null }
  const ids = orders.map((o) => o.id)
  const [attempts, ledger, refunds, disputes] = await Promise.all([
    db.$queryRawUnsafe<WithOrder<OrderMoneySnapshot["attempts"][number]>[]>(MONEY_INVARIANTS_SQL.attempts, ids),
    db.$queryRawUnsafe<WithOrder<OrderMoneySnapshot["ledger"][number]>[]>(MONEY_INVARIANTS_SQL.ledger, ids),
    db.$queryRawUnsafe<WithOrder<OrderMoneySnapshot["refunds"][number]>[]>(MONEY_INVARIANTS_SQL.refunds, ids),
    db.$queryRawUnsafe<WithOrder<OrderMoneySnapshot["disputes"][number]>[]>(MONEY_INVARIANTS_SQL.disputes, ids),
  ])
  const [a, l, r, d] = [groupBy(attempts), groupBy(ledger), groupBy(refunds), groupBy(disputes)]
  const snapshots = orders.map((o) => ({
    orderId: o.id,
    status: o.status,
    paymentSettlementStatus: o.paymentSettlementStatus,
    payoutStatus: o.payoutStatus,
    totalCents: numOrNull(o.totalCents),
    subtotalCents: numOrNull(o.subtotalCents),
    taxCents: numOrNull(o.taxCents),
    sellingPriceCents: num(o.sellingPriceCents),
    attempts: (a.get(o.id) ?? []).map((x) => ({ ...x, amountCents: num(x.amountCents) })),
    ledger: (l.get(o.id) ?? []).map((x) => ({
      ...x,
      amountCents: num(x.amountCents),
      createdAt: new Date(x.createdAt),
    })),
    refunds: (r.get(o.id) ?? []).map((x) => ({ amountCents: num(x.amountCents) })),
    disputes: (d.get(o.id) ?? []).map((x) => ({ status: x.status, createdAt: new Date(x.createdAt) })),
  }))
  return { snapshots, nextAfterId: orders.length < limit ? null : orders[orders.length - 1]!.id }
}
