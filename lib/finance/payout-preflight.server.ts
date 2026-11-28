import { planDisputeReconciliation, type StripeDisputeLite } from "@/lib/finance/dispute-reconcile"
import { evaluateOrderMoneyInvariants, summarizeMoneyInvariants } from "@/lib/finance/money-invariants"
import type { MoneyInvariantViolation } from "@/lib/finance/money-invariants"
import { loadOrderMoneySnapshots, type RawQueryable } from "@/lib/finance/money-invariants.server"
import type { PreflightInput } from "@/lib/finance/payout-preflight"
import { findStripeTransferDuplicates, type StripeTransferLite } from "@/lib/finance/stripe-transfer-duplicates"
import { checkEndpointSubscription, type WebhookEndpointLike } from "@/lib/stripe-webhook-required-events"

type Window = { created: { gte: number }; limit: number }
export type StripeRefundLite = {
  id: string
  amount: number
  charge: string | { id: string } | null
  status?: string | null
}
export type StripeDisputeListItem = { id: string; status: string; charge: string | { id: string } | null }
export type StripeChargeLite = { id: string; created: number; status?: string | null }

/** The Stripe reads the preflight needs — LIST calls only (real SDK lists are async-iterable over every page). */
export type PreflightStripe = {
  webhookEndpoints: { list(params: { limit: number }): AsyncIterable<WebhookEndpointLike> }
  transfers: { list(params: Window): AsyncIterable<StripeTransferLite> }
  refunds: { list(params: Window): AsyncIterable<StripeRefundLite> }
  disputes: { list(params: Window): AsyncIterable<StripeDisputeListItem> }
  charges: { list(params: { limit: number }): AsyncIterable<StripeChargeLite> }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null))

export function stripeKeyMode(key: string | undefined | null): PreflightInput["keyMode"] {
  if (!key) return null
  if (/^(sk|rk)_test_/.test(key)) return "test"
  if (/^(sk|rk)_live_/.test(key)) return "live"
  return "unknown"
}

/** Every page or nothing: an error mid-pagination fails the whole read (a partial list is never judged). */
async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of it) out.push(x)
  return out
}

async function first<T>(it: AsyncIterable<T>): Promise<T | null> {
  for await (const x of it) return x
  return null
}

/**
 * Reads everything the preflight judges — Stripe (LIST calls only) and the database (SELECT only; the script runs it
 * in a server-enforced read-only session). Each part fails on its own: its check is then BLOCKED with the error, the
 * others still run.
 */
export async function gatherPayoutPreflight(args: {
  stripe: PreflightStripe | null
  db: RawQueryable | null
  keyMode: PreflightInput["keyMode"]
  sinceDays: number
  webhookUrlContains?: string
}): Promise<PreflightInput> {
  const input: PreflightInput = {
    keyMode: args.keyMode,
    webhooks: null,
    invariants: null,
    duplicates: null,
    consistency: null,
    refunds: null,
    disputes: null,
    freshness: null,
    errors: {},
  }
  const errors = input.errors!
  const since = new Date(Date.now() - args.sinceDays * 86_400_000)
  const win = { created: { gte: Math.floor(since.getTime() / 1000) }, limit: 100 }

  let transfers: StripeTransferLite[] | null = null
  let refunds: StripeRefundLite[] | null = null
  let disputes: StripeDisputeListItem[] | null = null
  let latestCharge: StripeChargeLite | null | undefined
  if (!args.stripe) {
    for (const k of ["webhooks", "duplicates", "consistency", "refunds", "disputes", "freshness"] as const) {
      errors[k] = "no Stripe key"
    }
  } else {
    const s = args.stripe
    try {
      input.webhooks = (await collect(s.webhookEndpoints.list({ limit: 100 })))
        .filter((ep) => !args.webhookUrlContains || ep.url.includes(args.webhookUrlContains))
        .map(checkEndpointSubscription)
    } catch (e) {
      errors.webhooks = errText(e)
    }
    try {
      transfers = await collect(s.transfers.list(win))
      input.duplicates = findStripeTransferDuplicates(transfers)
    } catch (e) {
      errors.duplicates = errors.consistency = errText(e)
    }
    try {
      refunds = await collect(s.refunds.list(win))
    } catch (e) {
      errors.refunds = errText(e)
    }
    try {
      disputes = await collect(s.disputes.list(win))
    } catch (e) {
      errors.disputes = errText(e)
    }
    try {
      latestCharge = await first(s.charges.list({ limit: 1 }))
    } catch (e) {
      errors.freshness = errText(e)
    }
  }

  const db = args.db
  if (!db) {
    for (const k of ["invariants", "consistency", "refunds", "disputes", "freshness"] as const) {
      errors[k] ??= "no database URL"
    }
    return input
  }
  const q = <T>(sql: string, ...values: unknown[]) => db.$queryRawUnsafe<T>(sql, ...values)

  try {
    const violations: MoneyInvariantViolation[] = []
    let checked = 0
    let afterId: string | undefined
    for (;;) {
      const page = await loadOrderMoneySnapshots(db, { since, afterId, limit: 500 })
      for (const snap of page.snapshots) violations.push(...evaluateOrderMoneyInvariants(snap))
      checked += page.snapshots.length
      if (!page.nextAfterId) break
      afterId = page.nextAfterId
    }
    input.invariants = { summary: summarizeMoneyInvariants(checked, violations), violations }
  } catch (e) {
    errors.invariants = errText(e)
  }

  if (transfers) {
    try {
      input.consistency = await checkTransfers(transfers, q)
    } catch (e) {
      errors.consistency = errText(e)
    }
  }

  if (refunds) {
    try {
      const live = refunds.filter((r) => !r.status || r.status === "succeeded" || r.status === "pending")
      const charges = [...new Set(live.map((r) => idOf(r.charge)).filter((c): c is string => Boolean(c)))]
      const orders =
        charges.length === 0
          ? []
          : await q<Array<{ id: string; charge: string }>>(
              `SELECT "id", "stripeChargeId" AS "charge" FROM "Order" WHERE "stripeChargeId" = ANY($1::text[])`,
              charges,
            )
      const orderByCharge = new Map(orders.map((o) => [o.charge, o.id]))
      const ours = live.filter((r) => orderByCharge.has(idOf(r.charge) ?? ""))
      const ids = ours.map((r) => r.id)
      const recorded = new Set(
        ids.length === 0
          ? []
          : (
              await q<Array<{ id: string }>>(
                `SELECT "stripeRefundId" AS "id" FROM "OrderStripeRefund" WHERE "stripeRefundId" = ANY($1::text[])`,
                ids,
              )
            ).map((r) => r.id),
      )
      input.refunds = {
        checked: ours.length,
        unrecorded: ours
          .filter((r) => !recorded.has(r.id))
          .map((r) => ({ refundId: r.id, orderId: orderByCharge.get(idOf(r.charge)!)!, amount: r.amount })),
      }
    } catch (e) {
      errors.refunds = errText(e)
    }
  }

  if (disputes) {
    try {
      const lite: StripeDisputeLite[] = disputes.map((d) => ({ id: d.id, status: d.status, charge: idOf(d.charge) }))
      const charges = [...new Set(lite.map((d) => d.charge).filter((c): c is string => Boolean(c)))]
      const withOrder = new Set(
        charges.length === 0
          ? []
          : (
              await q<Array<{ charge: string }>>(
                `SELECT "stripeChargeId" AS "charge" FROM "Order" WHERE "stripeChargeId" = ANY($1::text[])`,
                charges,
              )
            ).map((r) => r.charge),
      )
      const holdRows =
        lite.length === 0
          ? []
          : await q<Array<{ id: string; status: string }>>(
              `SELECT "id", "status" FROM "ProcessedWebhook" WHERE "id" LIKE ANY($1::text[])`,
              lite.map((d) => `dispute:${d.id}:%`),
            )
      const holds = new Map<string, string[]>()
      for (const row of holdRows) {
        const dp = row.id.split(":")[1] ?? ""
        holds.set(dp, [...(holds.get(dp) ?? []), row.status])
      }
      input.disputes = {
        seen: lite.filter((d) => d.charge && withOrder.has(d.charge)).length,
        decisions: planDisputeReconciliation(lite, withOrder, holds),
      }
    } catch (e) {
      errors.disputes = errText(e)
    }
  }

  if (latestCharge !== undefined) {
    try {
      const rows = await q<Array<{ at: Date | string | null }>>(
        `SELECT max("createdAt") AS "at" FROM "ProcessedWebhook" WHERE "id" LIKE 'evt_%'`,
      )
      const at = rows[0]?.at ?? null
      input.freshness = {
        latestChargeAt: latestCharge ? new Date(latestCharge.created * 1000).toISOString() : null,
        latestWebhookAt: at === null ? null : new Date(at).toISOString(),
      }
    } catch (e) {
      errors.freshness = errText(e)
    }
  }

  return input
}

/** Stripe transfers of OUR orders vs ledger + attempts: unrecorded, amount / destination mismatch, unknown account. */
async function checkTransfers(
  transfers: StripeTransferLite[],
  q: <T>(sql: string, ...values: unknown[]) => Promise<T>,
): Promise<NonNullable<PreflightInput["consistency"]>> {
  const groups = [...new Set(transfers.map((t) => t.transfer_group).filter((g): g is string => Boolean(g)))]
  const ours = new Set(
    groups.length === 0
      ? []
      : (await q<Array<{ id: string }>>(`SELECT "id" FROM "Order" WHERE "id" = ANY($1::text[])`, groups)).map(
          (r) => r.id,
        ),
  )
  const mine = transfers.filter((t) => t.transfer_group && ours.has(t.transfer_group))
  const out: NonNullable<PreflightInput["consistency"]> = {
    orderTransfers: mine.length,
    unrecorded: [],
    mismatches: [],
    unknownDestinations: [],
    reversalsUnrecorded: [],
  }
  await checkSupplierPayments(transfers, q, out)
  if (mine.length === 0) return out

  const ids = mine.map((t) => t.id)
  const dests = [...new Set(mine.map((t) => idOf(t.destination)).filter((d): d is string => Boolean(d)))]
  const orderIds = [...new Set(mine.map((t) => t.transfer_group!))]
  const [ledger, attempts, known, clawRows] = await Promise.all([
    q<Array<{ id: string; amount: number }>>(
      `SELECT "stripeTransferId" AS "id", "amountCents" AS "amount" FROM "MerchantPayoutLedger"
       WHERE "stripeTransferId" = ANY($1::text[])`,
      ids,
    ),
    q<Array<{ id: string; amount: number; destination: string }>>(
      `SELECT "stripeTransferId" AS "id", "amountCents" AS "amount", "destination" FROM "TransferAttempt"
       WHERE "stripeTransferId" = ANY($1::text[])`,
      ids,
    ),
    q<Array<{ acct: string }>>(
      `SELECT "stripeAccountId" AS "acct" FROM "User" WHERE "stripeAccountId" = ANY($1::text[])
       UNION SELECT "stripeConnectAccountId" FROM "FulfillmentProvider" WHERE "stripeConnectAccountId" = ANY($1::text[])`,
      dests,
    ),
    // CLAWBACK rows carry the clawback's own id, not the transfer's: compared per order.
    q<Array<{ orderId: string; cents: number }>>(
      `SELECT "orderId", coalesce(sum(abs("amountCents")), 0)::int AS "cents" FROM "MerchantPayoutLedger"
       WHERE "entryType" = 'CLAWBACK' AND "orderId" = ANY($1::text[]) GROUP BY "orderId"`,
      orderIds,
    ),
  ])
  const ledgerById = new Map(ledger.map((r) => [r.id, r]))
  const attemptById = new Map(attempts.map((r) => [r.id, r]))
  const knownAccts = new Set(known.map((r) => r.acct))
  const clawByOrder = new Map(clawRows.map((r) => [r.orderId, Number(r.cents)]))
  const reversedByOrder = new Map<string, number>()
  for (const t of mine) {
    reversedByOrder.set(t.transfer_group!, (reversedByOrder.get(t.transfer_group!) ?? 0) + (t.amount_reversed ?? 0))
  }

  for (const t of mine) {
    const dest = idOf(t.destination) ?? ""
    const l = ledgerById.get(t.id)
    const a = attemptById.get(t.id)
    if (!l && !a) out.unrecorded.push({ transferId: t.id, transferGroup: t.transfer_group!, amount: t.amount })
    const recordedAmount = l?.amount ?? a?.amount
    if (recordedAmount !== undefined && Math.abs(Number(recordedAmount)) !== t.amount) {
      out.mismatches!.push({
        transferId: t.id,
        kind: "amount",
        stripe: String(t.amount),
        recorded: String(recordedAmount),
      })
    }
    if (a && a.destination !== dest) {
      out.mismatches!.push({ transferId: t.id, kind: "destination", stripe: dest, recorded: a.destination })
    }
    if (!knownAccts.has(dest)) out.unknownDestinations!.push({ transferId: t.id, destination: dest })
    const reversed = t.amount_reversed ?? 0
    const clawed = clawByOrder.get(t.transfer_group!) ?? 0
    if (reversed > 0 && clawed < (reversedByOrder.get(t.transfer_group!) ?? 0)) {
      out.reversalsUnrecorded!.push({ transferId: t.id, reversedCents: reversed, clawedBackCents: clawed })
    }
  }
  return out
}

/**
 * Batch-engine supplier payments (metadata.purchaseClaimToken, see lib/auto-order/payment): one live transfer per
 * claim token, and each one recorded on its claim (SupplierPurchaseClaim.paymentRef). The claim table ships with the
 * supplier-purchase lock: if it does not exist, any such transfer is reported as outside the lock.
 */
async function checkSupplierPayments(
  transfers: StripeTransferLite[],
  q: <T>(sql: string, ...values: unknown[]) => Promise<T>,
  out: NonNullable<PreflightInput["consistency"]>,
): Promise<void> {
  const live = transfers.filter((t) => t.metadata?.purchaseClaimToken && (t.amount_reversed ?? 0) < t.amount)
  out.supplierPaymentDuplicates = []
  out.supplierPaymentsUnrecorded = []
  if (live.length === 0) return
  const byToken = new Map<string, string[]>()
  for (const t of live) {
    const token = t.metadata!.purchaseClaimToken!
    byToken.set(token, [...(byToken.get(token) ?? []), t.id])
  }
  for (const [token, ids] of byToken)
    if (ids.length > 1) out.supplierPaymentDuplicates.push({ token, transferIds: ids })
  const [{ exists }] = await q<Array<{ exists: boolean }>>(
    `SELECT to_regclass('"SupplierPurchaseClaim"') IS NOT NULL AS "exists"`,
  )
  if (!exists) {
    for (const t of live) {
      out.supplierPaymentsUnrecorded.push({
        transferId: t.id,
        token: t.metadata!.purchaseClaimToken!,
        reason: "claim table missing",
      })
    }
    return
  }
  const recorded = new Set(
    (
      await q<Array<{ ref: string }>>(
        `SELECT DISTINCT "paymentRef" AS "ref" FROM "SupplierPurchaseClaim" WHERE "paymentRef" = ANY($1::text[])`,
        live.map((t) => t.id),
      )
    ).map((r) => r.ref),
  )
  for (const t of live) {
    if (!recorded.has(t.id)) {
      out.supplierPaymentsUnrecorded.push({
        transferId: t.id,
        token: t.metadata!.purchaseClaimToken!,
        reason: "not recorded on its claim",
      })
    }
  }
}
