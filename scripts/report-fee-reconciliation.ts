/**
 * READ-ONLY reconciliation of the two ESTIMATED costs of Affisell's margin against what was really taken.
 * Writes NOTHING: no database write, no Stripe object created, refunded or changed — only `retrieve` / `list` reads.
 *
 *   npm run report:fee-reconciliation                     # paid orders of the last 30 days, at most 200 charges
 *   npm run report:fee-reconciliation -- --days=60 --limit=100 --json
 *
 * 1. Stripe fee: per charge, the balance transaction's real `fee` (EUR only), split over the cart's orders pro rata,
 *    compared with the cockpit's estimate (2.9 % + 25 c of each order's TTC total).
 * 2. AliExpress debit on the auto-buy path: per order with a single-use Issuing card (`FulfillmentLog.virtualCardId`),
 *    captures − refunds of that card, compared with `Order.aeWholesaleCents`. The AliExpress-API path (paid by the
 *    dropshipping account, readable through `aliexpress.trade.ds.order.get`) is NOT read here (it needs the AliExpress
 *    token); `aeOrderAmountCents` in `lib/strategic-intelligence/fee-reconciliation.ts` is the parser for it.
 *
 * Keys: uses the DATABASE_URL of .env.local / .env (possibly PRODUCTION — reads only) and STRIPE_SECRET_KEY. A LIVE key is
 * refused outside production by `lib/stripe-key-guard.ts`; prefer a RESTRICTED key with read access to Charges, Balance
 * and Issuing transactions only (`rk_live_…`, created by the founder), with AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION=1.
 * Output: amounts and counts only, no card number, no buyer data.
 */
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

import { estimateStripeFeeCents } from "../lib/marketplace-split-amounts"
import { orderChargedTotalCents } from "../lib/money/split-guard"
import { getStripeClient } from "../lib/stripe"
import {
  allocateChargeFee,
  issuingNetDebitCents,
  stripeFeeFromBalanceTransaction,
  summarizeGaps,
  type FeeComparison,
} from "../lib/strategic-intelligence/fee-reconciliation"

config({ path: ".env.local" })
config({ path: ".env" })

const arg = (name: string, dflt: number) => Number((process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${dflt}`).split("=")[1]) || dflt
const asJson = process.argv.includes("--json")
const DAYS = Math.min(arg("days", 30), 365)
const LIMIT = Math.min(arg("limit", 200), 1000)
const prisma = new PrismaClient()

async function main() {
  const stripe = getStripeClient()
  const since = new Date(Date.now() - DAYS * 86_400_000)
  const orders = await prisma.order.findMany({
    where: { paidAt: { gte: since }, stripePaymentIntentId: { not: null } },
    orderBy: { paidAt: "desc" },
    take: LIMIT * 5,
    select: { id: true, stripePaymentIntentId: true, totalCents: true, subtotalCents: true, sellingPriceCents: true, taxCents: true, usesAffisellAutoBuy: true, aeWholesaleCents: true },
  })
  const byIntent = new Map<string, typeof orders>()
  for (const o of orders) {
    const list = byIntent.get(o.stripePaymentIntentId!) ?? []
    list.push(o)
    byIntent.set(o.stripePaymentIntentId!, list)
  }

  const fee: FeeComparison[] = []
  const cartFee: FeeComparison[] = []
  let unreadable = 0
  let nonEur = 0
  for (const [pi, group] of [...byIntent].slice(0, LIMIT)) {
    try {
      const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge.balance_transaction"] })
      const charge = intent.latest_charge
      const bt = charge && typeof charge === "object" ? charge.balance_transaction : null
      const real = stripeFeeFromBalanceTransaction(bt)
      if (real === null) {
        if (bt && typeof bt === "object") nonEur += 1
        else unreadable += 1
        continue
      }
      const parts = allocateChargeFee(real, group.map((o) => ({ id: o.id, chargedCents: orderChargedTotalCents(o) })))
      for (const o of group) {
        const row = { estimateCents: estimateStripeFeeCents(orderChargedTotalCents(o)), actualCents: parts.get(o.id)! }
        fee.push(row)
        if (group.length > 1) cartFee.push(row)
      }
    } catch {
      unreadable += 1
    }
  }

  const logs = await prisma.fulfillmentLog.findMany({
    where: { virtualCardId: { not: null }, order: { paidAt: { gte: since } } },
    take: LIMIT,
    select: { orderId: true, virtualCardId: true, order: { select: { aeWholesaleCents: true } } },
  })
  const issuing: FeeComparison[] = []
  let issuingUnknown = 0
  for (const l of logs) {
    try {
      const tx = await stripe.issuing.transactions.list({ card: l.virtualCardId!, limit: 20 })
      const real = issuingNetDebitCents(tx.data)
      const est = l.order.aeWholesaleCents ?? 0
      if (real === null || est <= 0) issuingUnknown += 1
      else issuing.push({ estimateCents: est, actualCents: real })
    } catch {
      issuingUnknown += 1
    }
  }

  const report = {
    window: { days: DAYS, since: since.toISOString() },
    stripeFee: { charges: Math.min(byIntent.size, LIMIT), unreadable, nonEur, all: summarizeGaps(fee), cartsOnly: summarizeGaps(cartFee) },
    aliexpressIssuing: { cards: logs.length, unknown: issuingUnknown, summary: summarizeGaps(issuing) },
    note: "real − estimate, cents. Reads only; nothing was recorded.",
  }
  if (asJson) console.log(JSON.stringify(report, null, 2))
  else {
    const fmt = (s: ReturnType<typeof summarizeGaps>) =>
      s ? `${s.n} lignes · écart moyen ${s.meanGapCents.toFixed(1)} c · |écart| moyen ${s.meanAbsGapCents.toFixed(1)} c · p90 ${s.p90AbsGapCents} c · ≤ 10 c : ${s.withinTenCents}/${s.n} · relatif ${s.relativeGap === null ? "n/a" : (s.relativeGap * 100).toFixed(1) + " %"}` : "aucune donnée"
    console.log(`Fenêtre : ${DAYS} jours (depuis ${report.window.since.slice(0, 10)})`)
    console.log(`Frais Stripe — ${report.stripeFee.charges} paiements lus, ${unreadable} illisibles, ${nonEur} hors EUR`)
    console.log(`  toutes commandes : ${fmt(report.stripeFee.all)}`)
    console.log(`  paniers seulement : ${fmt(report.stripeFee.cartsOnly)}`)
    console.log(`Débit AliExpress (cartes Issuing) — ${logs.length} cartes, ${issuingUnknown} sans montant comparable`)
    console.log(`  ${fmt(report.aliexpressIssuing.summary)}`)
    console.log(report.note)
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "report_failed")
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
