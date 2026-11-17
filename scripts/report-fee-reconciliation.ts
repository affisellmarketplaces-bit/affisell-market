/**
 * READ-ONLY reconciliation of the two ESTIMATED costs of Affisell's margin (Stripe's fee, the AliExpress debit) against
 * what was really taken. The logic and its proofs live in `lib/strategic-intelligence/fee-reconciliation-run.ts`; this
 * file only wires the real clients and prints.
 *
 *   npm run report:fee-reconciliation                                  # PLAN: database reads only, prints the read scope
 *   npm run report:fee-reconciliation -- --execute                     # + Stripe fees (balance_read only)
 *   npm run report:fee-reconciliation -- --execute --issuing           # + Issuing captures (issuing_transaction_read)
 *   npm run report:fee-reconciliation -- --execute --ae                # + AliExpress API order amounts (stored token, never refreshed)
 *   options: --days=30 --limit=200 --allow-payment-intent-read --json
 *
 * Writes NOTHING: the database client refuses every non-read operation and works inside a transaction PostgreSQL keeps
 * READ ONLY; the Stripe facade exposes three GET calls; the AliExpress token is never refreshed. In plan mode (the
 * default) no key is read and nothing outside the database is contacted.
 * Stripe key: `STRIPE_RECONCILIATION_KEY` (preferred) else `STRIPE_SECRET_KEY`; a FULL live key (`sk_live_`) is refused —
 * create a RESTRICTED key with READ « Balance » (+ « Issuing Transactions » for --issuing, « PaymentIntents » only for
 * --allow-payment-intent-read). Live keys outside production also need AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION=1.
 * Database: the DATABASE_URL of .env.local / .env — possibly PRODUCTION (reads only).
 * Output: aggregates only. No id, e-mail, card, token or raw error message is printed.
 */
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import Stripe from "stripe"

import { readAliExpressConfig } from "../lib/aliexpress-config"
import { ALIEXPRESS_DS_SYNC_HOSTS, callAliExpressSyncMethod } from "../lib/aliexpress-ds-sync"
import { decryptString } from "../lib/crypto"
import { assertStripeKeyAllowed } from "../lib/stripe-key-guard"
import { aeOrderAmount, formatReport, type AeRecon, type BalanceTxFacts, type StripeLookup } from "../lib/strategic-intelligence/fee-reconciliation"
import {
  pickReconciliationKey,
  readOnlyPrismaClient,
  readReconciliationFacts,
  runFeeReconciliation,
  type RunDeps,
  type StripeReader,
} from "../lib/strategic-intelligence/fee-reconciliation-run"

config({ path: ".env.local" })
config({ path: ".env" })

const flag = (name: string) => process.argv.includes(`--${name}`)
const num = (name: string, dflt: number, max: number) =>
  Math.min(max, Math.max(1, Number((process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${dflt}`).split("=")[1]) || dflt))

const base = new PrismaClient()
const db = readOnlyPrismaClient(base)

/** The ONLY Stripe calls this script can make — all GET. Built in execute mode only. */
function stripeReader(): StripeReader {
  const key = pickReconciliationKey(process.env)
  assertStripeKeyAllowed(key)
  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15_000 })
  const classify = (e: unknown): StripeLookup => {
    const err = e as { type?: string; statusCode?: number; code?: string }
    if (err?.type === "StripeAuthenticationError") throw new Error("stripe_authentication_failed")
    if (err?.type === "StripePermissionError" || err?.statusCode === 403) return { kind: "no_access" }
    if (err?.code === "resource_missing" || err?.statusCode === 404) return { kind: "not_found" }
    return { kind: "error" }
  }
  return Object.freeze({
    async balanceTxsOfCharge(chargeId: string): Promise<StripeLookup> {
      try {
        const page = await stripe.balanceTransactions.list({ source: chargeId, limit: 10 })
        return { kind: "read", txs: page.data as unknown as BalanceTxFacts[] }
      } catch (e) {
        return classify(e)
      }
    },
    async latestChargeOfIntent(intentId: string) {
      try {
        const pi = await stripe.paymentIntents.retrieve(intentId)
        const c = pi.latest_charge
        const id = typeof c === "string" ? c : c?.id
        return id ? { chargeId: id } : ({ kind: "not_found" } as StripeLookup)
      } catch (e) {
        return classify(e)
      }
    },
    async issuingTransactionsOfCard(cardId: string) {
      try {
        const page = await stripe.issuing.transactions.list({ card: cardId, limit: 100 })
        return { ok: true as const, txs: page.data.map((t) => ({ amount: t.amount, currency: t.currency, type: t.type })) }
      } catch (e) {
        return { ok: false as const, lookup: classify(e) }
      }
    },
  })
}

/** AliExpress order amounts with the STORED token only (decrypted in memory, never refreshed, never written). */
const aeOrderAmounts: RunDeps["aeOrderAmounts"] = async (rows, tokenRow) => {
  const fail = (reason: string) => rows.map((r): AeRecon => ({ path: "api", status: "non_rapproche", reason, estimateCents: r.estimateCents, actualCents: null }))
  if (!tokenRow?.accessExpiresAt || tokenRow.accessExpiresAt.getTime() - Date.now() < 10 * 60_000) return fail("jeton_absent_ou_expire_non_renouvele")
  let token: string
  let common: { appKey: string; appSecret: string }
  try {
    token = decryptString(tokenRow.accessTokenEncrypted)
    const cfg = readAliExpressConfig()
    common = { appKey: cfg.appKey, appSecret: cfg.appSecret }
  } catch {
    return fail("configuration_aliexpress_illisible")
  }
  const out: AeRecon[] = []
  for (const r of rows) {
    let result: AeRecon = { path: "api", status: "non_rapproche", reason: "erreur_de_lecture", estimateCents: r.estimateCents, actualCents: null }
    for (const host of ALIEXPRESS_DS_SYNC_HOSTS) {
      try {
        const payload = await callAliExpressSyncMethod({ ...common, accessToken: token, host, method: "aliexpress.trade.ds.order.get", bizParams: { single_order_query: JSON.stringify({ order_id: r.supplierOrderId }) } })
        const a = aeOrderAmount(payload)
        result = { path: "api", status: a.status, reason: a.reason, estimateCents: r.estimateCents, actualCents: a.cents }
        break
      } catch {
        // never print the error: a network error can carry the request URL, hence the token
      }
    }
    out.push(result)
    await new Promise((res) => setTimeout(res, 300))
  }
  return out
}

async function main() {
  const report = await runFeeReconciliation(
    {
      days: num("days", 30, 365),
      limit: num("limit", 200, 1000),
      execute: flag("execute"),
      issuing: flag("issuing"),
      ae: flag("ae"),
      allowPaymentIntentRead: flag("allow-payment-intent-read"),
      now: new Date(),
    },
    { readFacts: (args) => readReconciliationFacts(db, args), stripeReader, aeOrderAmounts }
  )
  console.log(flag("json") ? JSON.stringify(report, null, 2) : formatReport(report))
}

main()
  .catch((e) => {
    // Static reason only: never the raw message (it could carry a URL with a token, or a key prefix).
    const msg = e instanceof Error ? e.message : ""
    const safe = /^(cle_[^\n]{0,200}|stripe_authentication_failed|reconciliation_write_refused:[a-zA-Z$]+)/.exec(msg)?.[0] ?? (e instanceof Error ? e.name : "report_failed")
    console.error(`report_failed: ${safe}`)
    process.exitCode = 1
  })
  .finally(() => base.$disconnect())
