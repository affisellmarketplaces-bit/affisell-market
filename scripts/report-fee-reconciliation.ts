/**
 * READ-ONLY reconciliation of the two ESTIMATED costs of Affisell's margin (Stripe's fee, the AliExpress debit) against
 * what was really taken. Writes NOTHING anywhere: no database write (the database reads run in a READ ONLY transaction
 * enforced by PostgreSQL), no Stripe object created / changed (the Stripe client is wrapped in a facade that exposes
 * three GET calls and nothing else), no AliExpress token refreshed (an expired token = « non rapproché »).
 *
 *   npm run report:fee-reconciliation                                  # PLAN: database reads only, prints the read scope
 *   npm run report:fee-reconciliation -- --execute                     # + Stripe fees (balance_read only)
 *   npm run report:fee-reconciliation -- --execute --issuing           # + Issuing captures (issuing_transaction_read)
 *   npm run report:fee-reconciliation -- --execute --ae                # + AliExpress API order amounts (stored token, never refreshed)
 *   options: --days=30 --limit=200 --allow-payment-intent-read --json
 *
 * Stripe key: `STRIPE_RECONCILIATION_KEY` (preferred) else `STRIPE_SECRET_KEY`. A FULL live key (`sk_live_`) is REFUSED:
 * create a RESTRICTED key with READ on « Balance » (balance_read) — plus « Issuing Transactions » for `--issuing`, and
 * « PaymentIntents » only for `--allow-payment-intent-read` (payments whose charge id is not stored). Live keys outside
 * production also need AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION=1 (lib/stripe-key-guard.ts).
 * Database: the DATABASE_URL of .env.local / .env — possibly PRODUCTION (reads only).
 * Output: aggregates only (counts, amounts, reasons). No id, e-mail, card, token or raw error message is printed.
 */
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import Stripe from "stripe"

import { orderChargedTotalCents } from "../lib/money/split-guard"
import { assertStripeKeyAllowed } from "../lib/stripe-key-guard"
import {
  aeOrderAmount,
  buildReport,
  formatReport,
  issuingNetDebit,
  paymentReadPlan,
  reconcilePayment,
  sharedAeOrderIds,
  type AeRecon,
  type BalanceTxFacts,
  type PaymentGroup,
  type PaymentRecon,
  type StripeLookup,
} from "../lib/strategic-intelligence/fee-reconciliation"

config({ path: ".env.local" })
config({ path: ".env" })

const flag = (name: string) => process.argv.includes(`--${name}`)
const num = (name: string, dflt: number, max: number) =>
  Math.min(max, Math.max(1, Number((process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${dflt}`).split("=")[1]) || dflt))
const EXECUTE = flag("execute")
const ISSUING = flag("issuing")
const AE = flag("ae")
const ALLOW_PI = flag("allow-payment-intent-read")
const DAYS = num("days", 30, 365)
const LIMIT = num("limit", 200, 1000)
const CHUNK = 50
const prisma = new PrismaClient()

const ORDER_MONEY = { id: true, stripeSessionId: true, stripeChargeId: true, stripePaymentIntentId: true, totalCents: true, subtotalCents: true, sellingPriceCents: true, taxCents: true } as const

type DbFacts = {
  groups: PaymentGroup[]
  cards: Array<{ cardId: string; estimateCents: number | null }>
  aeOrders: Array<{ supplierOrderId: string; estimateCents: number | null }>
}

/** Every database read, in ONE transaction PostgreSQL itself refuses to write in. */
async function readDatabase(since: Date): Promise<DbFacts> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SET TRANSACTION READ ONLY`
      const paid = await tx.order.findMany({ where: { paidAt: { gte: since } }, orderBy: { paidAt: "desc" }, take: LIMIT * 10, select: { stripeSessionId: true } })
      const bases = [...new Set(paid.map((o) => o.stripeSessionId.split(":line:")[0]!).filter(Boolean))].slice(0, LIMIT)
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
        where: { virtualCardId: { not: null }, order: { paidAt: { gte: since } } },
        take: LIMIT,
        select: { orderId: true, virtualCardId: true, order: { select: { aeWholesaleCents: true } } },
      })
      const cardOrderIds = new Set(logs.map((l) => l.orderId))
      // AliExpress-API purchases: Affisell-bought lines with an AliExpress-shaped order id, not paid by an Issuing card.
      const apiRows = await tx.order.findMany({
        where: { paidAt: { gte: since }, usesAffisellAutoBuy: true, supplierOrderId: { not: null } },
        take: LIMIT,
        select: { id: true, supplierOrderId: true, aeWholesaleCents: true },
      })
      return {
        groups: [...groups.values()].filter((g) => g.orders.length > 0),
        cards: logs.map((l) => ({ cardId: l.virtualCardId!, estimateCents: l.order.aeWholesaleCents })),
        aeOrders: apiRows
          .filter((r) => !cardOrderIds.has(r.id) && /^\d{6,30}$/.test(r.supplierOrderId!.trim()))
          .map((r) => ({ supplierOrderId: r.supplierOrderId!.trim(), estimateCents: r.aeWholesaleCents })),
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  )
}

/** The ONLY Stripe calls this script can make — all GET. */
function stripeReader(key: string) {
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
    async latestChargeOfIntent(intentId: string): Promise<{ chargeId: string } | StripeLookup> {
      try {
        const pi = await stripe.paymentIntents.retrieve(intentId)
        const c = pi.latest_charge
        const id = typeof c === "string" ? c : c?.id
        return id ? { chargeId: id } : { kind: "not_found" }
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

function resolveStripeKey(): string {
  const key = (process.env.STRIPE_RECONCILIATION_KEY || process.env.STRIPE_SECRET_KEY || "").trim()
  if (!key) throw new Error("cle_stripe_absente")
  if (key.startsWith("sk_live_")) throw new Error("cle_complete_refusee: creer une cle restreinte en lecture (Balance, + Issuing Transactions si --issuing)")
  assertStripeKeyAllowed(key)
  return key
}

/** AliExpress order amounts with the STORED token only — never refreshed (a refresh writes the token store). */
async function readAeOrders(rows: DbFacts["aeOrders"]): Promise<AeRecon[]> {
  const shared = sharedAeOrderIds(rows)
  const out: AeRecon[] = []
  const pending: typeof rows = []
  for (const r of rows) {
    if (shared.has(r.supplierOrderId)) out.push({ path: "api", status: "incertain", reason: "commande_aliexpress_partagee", estimateCents: r.estimateCents, actualCents: null })
    else pending.push(r)
  }
  if (pending.length === 0) return out
  const notReconciled = (reason: string) => pending.map((r): AeRecon => ({ path: "api", status: "non_rapproche", reason, estimateCents: r.estimateCents, actualCents: null }))
  let token: string
  let common: { appKey: string; appSecret: string }
  let call: typeof import("../lib/aliexpress-ds-sync").callAliExpressSyncMethod
  let hosts: readonly string[]
  try {
    const store = await import("../lib/aliexpress-token-store")
    const tokens = await store.loadAliExpressTokensFromDb()
    if (!tokens?.accessToken || !tokens.accessExpiresAt || tokens.accessExpiresAt.getTime() - Date.now() < 10 * 60_000) {
      return [...out, ...notReconciled("jeton_absent_ou_expire_non_renouvele")]
    }
    token = tokens.accessToken
    const cfg = (await import("../lib/aliexpress-config")).readAliExpressConfig()
    common = { appKey: cfg.appKey, appSecret: cfg.appSecret }
    const sync = await import("../lib/aliexpress-ds-sync")
    call = sync.callAliExpressSyncMethod
    hosts = sync.ALIEXPRESS_DS_SYNC_HOSTS
  } catch {
    return [...out, ...notReconciled("configuration_aliexpress_illisible")]
  }
  for (const r of pending) {
    let result: AeRecon = { path: "api", status: "non_rapproche", reason: "erreur_de_lecture", estimateCents: r.estimateCents, actualCents: null }
    for (const host of hosts) {
      try {
        const payload = await call({ ...common, accessToken: token, host, method: "aliexpress.trade.ds.order.get", bizParams: { single_order_query: JSON.stringify({ order_id: r.supplierOrderId }) } })
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
  const since = new Date(Date.now() - DAYS * 86_400_000)
  const db = await readDatabase(since)
  await prisma.$disconnect()

  const plans = db.groups.map(paymentReadPlan)
  const byCharge = plans.filter((p) => p.by === "charge").length
  const byIntent = plans.filter((p) => p.by === "payment_intent").length
  const readScope = [
    `Base (transaction READ ONLY) : commandes payées depuis ${since.toISOString().slice(0, 10)} et toutes les commandes de leurs paiements ; journaux d'achat avec carte ; commandes achetées par Affisell`,
    `Stripe GET /v1/balance_transactions?source=<charge> (balance_read) : ${byCharge} paiements${EXECUTE ? "" : " — non lancé"}`,
    `Stripe GET /v1/payment_intents/<id> (payment_intent_read) : ${byIntent} paiements sans charge en base${ALLOW_PI && EXECUTE ? "" : " — non lancé (--allow-payment-intent-read)"}`,
    `Stripe GET /v1/issuing/transactions?card=<carte> (issuing_transaction_read) : ${db.cards.length} cartes${ISSUING && EXECUTE ? "" : " — non lancé (--issuing)"}`,
    `AliExpress aliexpress.trade.ds.order.get, jeton stocké jamais renouvelé (une lecture du coffre de jetons) : ${db.aeOrders.length} commandes${AE && EXECUTE ? "" : " — non lancé (--ae)"}`,
  ]

  const reader = EXECUTE && (db.groups.length > 0 || (ISSUING && db.cards.length > 0)) ? stripeReader(resolveStripeKey()) : null
  const payments: PaymentRecon[] = []
  for (const g of db.groups) {
    const plan = paymentReadPlan(g)
    let lookup: StripeLookup = { kind: "skipped" }
    if (reader && plan.by === "charge") lookup = await reader.balanceTxsOfCharge(plan.id)
    if (reader && plan.by === "payment_intent" && ALLOW_PI) {
      const c = await reader.latestChargeOfIntent(plan.id)
      lookup = "chargeId" in c ? await reader.balanceTxsOfCharge(c.chargeId) : c
    }
    payments.push(reconcilePayment(g, lookup))
  }

  const ae: AeRecon[] = []
  for (const c of db.cards) {
    if (!(reader && ISSUING)) {
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
  if (EXECUTE && AE) ae.push(...(await readAeOrders(db.aeOrders)))
  else for (const r of db.aeOrders) ae.push({ path: "api", status: "estime", reason: "lecture_non_lancee", estimateCents: r.estimateCents, actualCents: null })

  const report = buildReport({ days: DAYS, since, mode: EXECUTE ? "execute" : "plan", payments, ae, readScope })
  console.log(flag("json") ? JSON.stringify(report, null, 2) : formatReport(report))
}

main().catch((e) => {
  // Static reason only: never the raw message (it could carry a URL with a token, or a key prefix).
  const msg = e instanceof Error ? e.message : ""
  const safe = /^(cle_[^\n]{0,200}|stripe_authentication_failed)/.exec(msg)?.[0] ?? (e instanceof Error ? e.name : "report_failed")
  console.error(`report_failed: ${safe}`)
  process.exitCode = 1
  return prisma.$disconnect()
})
