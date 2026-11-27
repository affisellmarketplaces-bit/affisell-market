import { evaluateOrderMoneyInvariants, summarizeMoneyInvariants } from "@/lib/finance/money-invariants"
import type { MoneyInvariantViolation } from "@/lib/finance/money-invariants"
import { loadOrderMoneySnapshots, type RawQueryable } from "@/lib/finance/money-invariants.server"
import type { PreflightInput } from "@/lib/finance/payout-preflight"
import { findStripeTransferDuplicates, type StripeTransferLite } from "@/lib/finance/stripe-transfer-duplicates"
import { checkEndpointSubscription, type WebhookEndpointLike } from "@/lib/stripe-webhook-required-events"

/** The two Stripe reads the preflight needs (real SDK lists are async-iterable over every page). */
export type PreflightStripe = {
  webhookEndpoints: { list(params: { limit: number }): AsyncIterable<WebhookEndpointLike> }
  transfers: { list(params: { created: { gte: number }; limit: number }): AsyncIterable<StripeTransferLite> }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

export function stripeKeyMode(key: string | undefined | null): PreflightInput["keyMode"] {
  if (!key) return null
  if (/^(sk|rk)_test_/.test(key)) return "test"
  if (/^(sk|rk)_live_/.test(key)) return "live"
  return "unknown"
}

/**
 * Reads everything the preflight judges — Stripe (webhook endpoints, transfers of the window) and the database
 * (SELECT only; the script runs it in a server-enforced read-only session). Each part fails on its own: its check is
 * then BLOCKED with the error, the others still run.
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
    errors: {},
  }
  const since = new Date(Date.now() - args.sinceDays * 86_400_000)

  let transfers: StripeTransferLite[] | null = null
  if (!args.stripe) {
    input.errors!.webhooks = input.errors!.duplicates = input.errors!.consistency = "no Stripe key"
  } else {
    try {
      const eps: WebhookEndpointLike[] = []
      for await (const ep of args.stripe.webhookEndpoints.list({ limit: 100 })) eps.push(ep)
      input.webhooks = eps
        .filter((ep) => !args.webhookUrlContains || ep.url.includes(args.webhookUrlContains))
        .map(checkEndpointSubscription)
    } catch (e) {
      input.errors!.webhooks = errText(e)
    }
    try {
      transfers = []
      for await (const t of args.stripe.transfers.list({
        created: { gte: Math.floor(since.getTime() / 1000) },
        limit: 100,
      })) {
        transfers.push(t)
      }
      input.duplicates = findStripeTransferDuplicates(transfers)
    } catch (e) {
      transfers = null
      input.errors!.duplicates = input.errors!.consistency = errText(e)
    }
  }

  if (!args.db) {
    input.errors!.invariants = "no database URL"
    input.errors!.consistency ??= "no database URL"
    return input
  }
  try {
    const violations: MoneyInvariantViolation[] = []
    let checked = 0
    let afterId: string | undefined
    for (;;) {
      const page = await loadOrderMoneySnapshots(args.db, { since, afterId, limit: 500 })
      for (const s of page.snapshots) violations.push(...evaluateOrderMoneyInvariants(s))
      checked += page.snapshots.length
      if (!page.nextAfterId) break
      afterId = page.nextAfterId
    }
    input.invariants = { summary: summarizeMoneyInvariants(checked, violations), violations }
  } catch (e) {
    input.errors!.invariants = errText(e)
  }

  if (transfers) {
    try {
      const groups = [...new Set(transfers.map((t) => t.transfer_group).filter((g): g is string => Boolean(g)))]
      const ours = new Set(
        groups.length === 0
          ? []
          : (
              await args.db.$queryRawUnsafe<Array<{ id: string }>>(
                `SELECT "id" FROM "Order" WHERE "id" = ANY($1::text[])`,
                groups,
              )
            ).map((r) => r.id),
      )
      const orderTransfers = transfers.filter((t) => t.transfer_group && ours.has(t.transfer_group))
      const ids = orderTransfers.map((t) => t.id)
      const recorded = new Set(
        ids.length === 0
          ? []
          : (
              await args.db.$queryRawUnsafe<Array<{ id: string }>>(
                `SELECT "stripeTransferId" AS "id" FROM "MerchantPayoutLedger" WHERE "stripeTransferId" = ANY($1::text[])
                 UNION SELECT "stripeTransferId" FROM "TransferAttempt" WHERE "stripeTransferId" = ANY($1::text[])`,
                ids,
              )
            ).map((r) => r.id),
      )
      input.consistency = {
        orderTransfers: orderTransfers.length,
        unrecorded: orderTransfers
          .filter((t) => !recorded.has(t.id))
          .map((t) => ({ transferId: t.id, transferGroup: t.transfer_group!, amount: t.amount })),
      }
    } catch (e) {
      input.errors!.consistency = errText(e)
    }
  }
  return input
}
