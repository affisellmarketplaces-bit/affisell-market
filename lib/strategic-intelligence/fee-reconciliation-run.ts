/**
 * The orchestration of `npm run report:fee-reconciliation`, with every outside access INJECTED so the read scope can be
 * proven by tests rather than asserted:
 *
 * - database: one interactive transaction whose FIRST statement is `SET TRANSACTION READ ONLY` — PostgreSQL itself then
 *   refuses any write in it (SQLSTATE 25006, proven on a real PostgreSQL by `fee-reconciliation-db.test.ts`) — on a client
 *   wrapped by `readOnlyPrismaClient`, which refuses every non-read operation BEFORE it reaches the database (two layers);
 * - plan mode (the default) calls NOTHING but that database read: no key is read, no Stripe client is built, no
 *   AliExpress call is made, no token is decrypted (proven by `fee-reconciliation-run.test.ts`, network spied);
 * - the AliExpress token row is read inside the same read-only transaction and only when `--execute --ae` is asked; it
 *   is decrypted in memory, never refreshed, never written, never printed.
 *
 * This module imports nothing that opens a connection or writes: no `@/lib/prisma`, no `server-only` module.
 */
import type { Prisma, PrismaClient } from "@prisma/client"

import { orderChargedTotalCents } from "@/lib/money/split-guard"
import {
  buildReport,
  issuingNetDebit,
  paymentReadPlan,
  reconcilePayment,
  sharedAeOrderIds,
  type AeRecon,
  type BalanceTxFacts,
  type PaymentGroup,
  type PaymentRecon,
  type ReconReport,
  type StripeLookup,
} from "@/lib/strategic-intelligence/fee-reconciliation"

export const READ_ONLY_STATEMENT = "SET TRANSACTION READ ONLY"

/** Prisma operations this tool may run; anything else is refused before it reaches the database. */
export const READ_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "$queryRaw",
])

export class ReconciliationWriteRefusedError extends Error {
  constructor(operation: string) {
    super(`reconciliation_write_refused:${operation}`)
    this.name = "ReconciliationWriteRefusedError"
  }
}

/** First layer: the client itself refuses every operation that is not a read (writes, `$executeRaw*`, `$queryRawUnsafe`). */
export function readOnlyPrismaClient<C extends PrismaClient>(client: C) {
  return client.$extends({
    name: "fee-reconciliation-read-only",
    query: {
      async $allOperations({ operation, args, query }) {
        if (!READ_OPERATIONS.has(operation)) throw new ReconciliationWriteRefusedError(operation)
        return query(args)
      },
    },
  })
}

/** Any client that can open an interactive transaction (the guarded extension or a plain client in tests). */
// Loose on purpose: an extended client's `$transaction` is overloaded (array form + callback form).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReadClient = { $transaction: (...args: any[]) => Promise<any> }

/** Second layer: the work runs in a transaction PostgreSQL itself keeps read-only. */
export async function withReadOnlyTransaction<T>(client: ReadClient, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return client.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SET TRANSACTION READ ONLY`
      return work(tx)
    },
    { timeout: 120_000, maxWait: 10_000 }
  )
}

export type DbFacts = {
  groups: PaymentGroup[]
  cards: Array<{ cardId: string; estimateCents: number | null }>
  aeOrders: Array<{ supplierOrderId: string; estimateCents: number | null }>
  /** Encrypted AliExpress token row — only read for `--execute --ae`, still encrypted here. */
  aeTokenRow: { accessTokenEncrypted: string; accessExpiresAt: Date | null } | null
}

const CHUNK = 50
const ORDER_MONEY = { id: true, stripeSessionId: true, stripeChargeId: true, stripePaymentIntentId: true, totalCents: true, subtotalCents: true, sellingPriceCents: true, taxCents: true } as const

/** Every database read of the report, in one read-only transaction. */
export async function readReconciliationFacts(client: ReadClient, args: { since: Date; limit: number; readAeToken: boolean }): Promise<DbFacts> {
  return withReadOnlyTransaction(client, async (tx) => {
    const paid = await tx.order.findMany({ where: { paidAt: { gte: args.since } }, orderBy: { paidAt: "desc" }, take: args.limit * 10, select: { stripeSessionId: true } })
    const bases = [...new Set(paid.map((o) => o.stripeSessionId.split(":line:")[0]!).filter(Boolean))].slice(0, args.limit)
    const groups = new Map<string, PaymentGroup>(bases.map((b) => [b, { key: b, orders: [], chargeIds: [], paymentIntentIds: [] }]))
    // ALL siblings of each payment, whatever their status or date: a cart is reconciled whole or not at all.
    for (let i = 0; i < bases.length; i += CHUNK) {
      const chunk = bases.slice(i, i + CHUNK)
      const rows = await tx.order.findMany({
        where: { OR: chunk.flatMap((b) => [{ stripeSessionId: b }, { stripeSessionId: { startsWith: `${b}:line:` } }]) },
        select: ORDER_MONEY,
      })
      for (const r of rows) {
        const g = groups.get(r.stripeSessionId.split(":line:")[0]!)
        if (!g) continue
        g.orders.push({ id: r.id, chargedCents: orderChargedTotalCents(r) })
        if (r.stripeChargeId) g.chargeIds.push(r.stripeChargeId)
        if (r.stripePaymentIntentId) g.paymentIntentIds.push(r.stripePaymentIntentId)
      }
    }
    const logs = await tx.fulfillmentLog.findMany({
      where: { virtualCardId: { not: null }, order: { paidAt: { gte: args.since } } },
      take: args.limit,
      select: { orderId: true, virtualCardId: true, order: { select: { aeWholesaleCents: true } } },
    })
    const cardOrderIds = new Set(logs.map((l) => l.orderId))
    // AliExpress-API purchases: Affisell-bought lines with an AliExpress-shaped order id, not paid by an Issuing card.
    const apiRows = await tx.order.findMany({
      where: { paidAt: { gte: args.since }, usesAffisellAutoBuy: true, supplierOrderId: { not: null } },
      take: args.limit,
      select: { id: true, supplierOrderId: true, aeWholesaleCents: true },
    })
    const aeTokenRow = args.readAeToken
      ? await tx.platformOAuthCredential.findUnique({ where: { provider: "aliexpress" }, select: { accessTokenEncrypted: true, accessExpiresAt: true } })
      : null
    return {
      groups: [...groups.values()].filter((g) => g.orders.length > 0),
      cards: logs.map((l) => ({ cardId: l.virtualCardId!, estimateCents: l.order.aeWholesaleCents })),
      aeOrders: apiRows
        .filter((r) => !cardOrderIds.has(r.id) && /^\d{6,30}$/.test(r.supplierOrderId!.trim()))
        .map((r) => ({ supplierOrderId: r.supplierOrderId!.trim(), estimateCents: r.aeWholesaleCents })),
      aeTokenRow,
    }
  })
}

// ---------------------------------------------------------------------------------------------------------------------

export type StripeReader = {
  balanceTxsOfCharge(chargeId: string): Promise<StripeLookup>
  latestChargeOfIntent(intentId: string): Promise<{ chargeId: string } | StripeLookup>
  issuingTransactionsOfCard(cardId: string): Promise<{ ok: true; txs: Array<{ amount?: unknown; currency?: unknown; type?: unknown }> } | { ok: false; lookup: StripeLookup }>
}

export type RunOptions = {
  days: number
  limit: number
  execute: boolean
  issuing: boolean
  ae: boolean
  allowPaymentIntentRead: boolean
  now: Date
}

export type RunDeps = {
  readFacts: (args: { since: Date; limit: number; readAeToken: boolean }) => Promise<DbFacts>
  /** Called only in execute mode, only when there is something to read at Stripe. */
  stripeReader: () => StripeReader
  /** Called only for `--execute --ae`. */
  aeOrderAmounts: (rows: DbFacts["aeOrders"], token: DbFacts["aeTokenRow"]) => Promise<AeRecon[]>
}

/** Which key the report may use: a full live key is refused (a restricted key is enough). Pure. */
export function pickReconciliationKey(env: Record<string, string | undefined>): string {
  const key = (env.STRIPE_RECONCILIATION_KEY || env.STRIPE_SECRET_KEY || "").trim()
  if (!key) throw new Error("cle_stripe_absente")
  if (key.startsWith("sk_live_")) throw new Error("cle_complete_refusee: creer une cle restreinte en lecture (Balance, + Issuing Transactions si --issuing)")
  return key
}

export function readScopeLines(o: RunOptions, since: Date, facts: DbFacts): string[] {
  const plans = facts.groups.map(paymentReadPlan)
  const byCharge = plans.filter((p) => p.by === "charge").length
  const byIntent = plans.filter((p) => p.by === "payment_intent").length
  return [
    `Base, transaction READ ONLY imposée par PostgreSQL : commandes payées depuis ${since.toISOString().slice(0, 10)} (≤ ${o.limit} paiements) et toutes les commandes de ces paiements ; journaux d'achat avec carte ; commandes achetées par Affisell${o.execute && o.ae ? " ; ligne chiffrée du jeton AliExpress" : ""}`,
    `Stripe GET /v1/balance_transactions?source=<charge> (balance_read) : ${byCharge} paiements${o.execute ? "" : " — non lancé (mode plan)"}`,
    `Stripe GET /v1/payment_intents/<id> (payment_intent_read) : ${byIntent} paiements sans charge en base${o.execute && o.allowPaymentIntentRead ? "" : " — non lancé"}`,
    `Stripe GET /v1/issuing/transactions?card=<carte> (issuing_transaction_read) : ${facts.cards.length} cartes${o.execute && o.issuing ? "" : " — non lancé"}`,
    `AliExpress aliexpress.trade.ds.order.get, jeton stocké jamais renouvelé : ${facts.aeOrders.length} commandes${o.execute && o.ae ? "" : " — non lancé"}`,
  ]
}

export async function runFeeReconciliation(o: RunOptions, deps: RunDeps): Promise<ReconReport> {
  const since = new Date(o.now.getTime() - o.days * 86_400_000)
  const facts = await deps.readFacts({ since, limit: o.limit, readAeToken: o.execute && o.ae })
  const needsStripe = o.execute && (facts.groups.length > 0 || (o.issuing && facts.cards.length > 0))
  const reader = needsStripe ? deps.stripeReader() : null

  const payments: PaymentRecon[] = []
  for (const g of facts.groups) {
    const plan = paymentReadPlan(g)
    let lookup: StripeLookup = { kind: "skipped" }
    if (reader && plan.by === "charge") lookup = await reader.balanceTxsOfCharge(plan.id)
    if (reader && plan.by === "payment_intent" && o.allowPaymentIntentRead) {
      const c = await reader.latestChargeOfIntent(plan.id)
      lookup = "chargeId" in c ? await reader.balanceTxsOfCharge(c.chargeId) : c
    }
    payments.push(reconcilePayment(g, lookup))
  }

  const ae: AeRecon[] = []
  for (const c of facts.cards) {
    if (!(reader && o.issuing)) {
      ae.push({ path: "issuing", status: "estime", reason: "lecture_non_lancee", estimateCents: c.estimateCents, actualCents: null })
      continue
    }
    const r = await reader.issuingTransactionsOfCard(c.cardId)
    if (!r.ok) {
      ae.push({ path: "issuing", status: "non_rapproche", reason: r.lookup.kind === "no_access" ? "permission_manquante" : "erreur_de_lecture", estimateCents: c.estimateCents, actualCents: null })
      continue
    }
    const d = issuingNetDebit(r.txs)
    ae.push({ path: "issuing", status: d.status, reason: d.reason, estimateCents: c.estimateCents, actualCents: d.cents })
  }

  if (o.execute && o.ae && facts.aeOrders.length > 0) {
    const shared = sharedAeOrderIds(facts.aeOrders)
    for (const r of facts.aeOrders.filter((x) => shared.has(x.supplierOrderId)))
      ae.push({ path: "api", status: "incertain", reason: "commande_aliexpress_partagee", estimateCents: r.estimateCents, actualCents: null })
    ae.push(...(await deps.aeOrderAmounts(facts.aeOrders.filter((x) => !shared.has(x.supplierOrderId)), facts.aeTokenRow)))
  } else {
    for (const r of facts.aeOrders) ae.push({ path: "api", status: "estime", reason: "lecture_non_lancee", estimateCents: r.estimateCents, actualCents: null })
  }

  return buildReport({ days: o.days, since, mode: o.execute ? "execute" : "plan", payments, ae, readScope: readScopeLines(o, since, facts) })
}

export type { BalanceTxFacts }
