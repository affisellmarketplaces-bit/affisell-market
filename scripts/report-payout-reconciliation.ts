/**
 * READ-ONLY reconciliation of Affisell's payout records with Stripe's transfers (docs/PAYOUT-LEG-REGISTRY.md §6).
 *
 *   npm run report:payout-reconciliation                     # PLAN: database only (legs in doubt, records that
 *                                                            # contradict each other); no key read, nothing contacted
 *   npm run report:payout-reconciliation -- --execute        # + Stripe: GET /v1/transfers created since the window
 *   options: --days=120 --json --target --confirm-endpoint=<ep>   (production needs the founder's written authorisation)
 *
 * Writes NOTHING, corrects NOTHING: the database is read in a READ ONLY transaction through a client that refuses every
 * write; the Stripe facade exposes ONE list call. Findings (orphan transfer, duplicate for a leg, amount / destination /
 * role mismatch, record not found in Stripe, leg in doubt…) are settled by a person with the documented procedures.
 * Stripe key: `STRIPE_RECONCILIATION_KEY` (preferred) else `STRIPE_SECRET_KEY`; a FULL live key (`sk_live_`) is refused —
 * create a RESTRICTED key with READ « Transfers » (Connect). Output: identifiers masked, no account id.
 */
import Stripe from "stripe"

import { runReadOnlyReport } from "./lib/read-only-report"

import type { StripeTransferView } from "../lib/payouts/leg-model"
import { maskId, reconcilePayouts, summarize, type Finding } from "../lib/payouts/reconciliation"
import { collectPayoutReconciliationFacts } from "../lib/reports/payout-reconciliation-report"
import { pickReconciliationKey } from "../lib/strategic-intelligence/fee-reconciliation-run"
import { assertStripeKeyAllowed } from "../lib/stripe-key-guard"

const asJson = process.argv.includes("--json")
const execute = process.argv.includes("--execute")
const days = Math.min(400, Math.max(1, Number((process.argv.find((a) => a.startsWith("--days=")) ?? "--days=120").split("=")[1]) || 120))
const since = new Date(Date.now() - days * 24 * 3600_000)
const STRIPE_MAX_PAGES = 50

/** The ONLY Stripe call this script can make: list transfers created since the window (GET). Built in execute mode only. */
function transferLister() {
  const key = pickReconciliationKey(process.env)
  assertStripeKeyAllowed(key)
  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15_000 })
  return Object.freeze({
    async listSince(from: Date): Promise<{ transfers: StripeTransferView[]; complete: boolean }> {
      const transfers: StripeTransferView[] = []
      let after: string | undefined
      for (let page = 0; page < STRIPE_MAX_PAGES; page += 1) {
        const res = await stripe.transfers.list({
          created: { gte: Math.floor(from.getTime() / 1000) },
          limit: 100,
          ...(after ? { starting_after: after } : {}),
        })
        for (const t of res.data) {
          transfers.push({
            id: t.id,
            amount: t.amount,
            currency: t.currency,
            destination: typeof t.destination === "string" ? t.destination : (t.destination?.id ?? null),
            transfer_group: t.transfer_group ?? null,
            metadata: (t.metadata ?? {}) as Record<string, string>,
            created: t.created,
          })
        }
        if (!res.has_more || res.data.length === 0) return { transfers, complete: !res.has_more }
        after = res.data[res.data.length - 1].id
      }
      return { transfers, complete: false }
    },
  })
}

const maskText = (s: string) => s.replace(/acct_[A-Za-z0-9]+/g, "acct_…").replace(/\btr_[A-Za-z0-9]+/g, (m) => maskId(m))

function print(result: { findings: Finding[]; mode: string; registryAvailable: boolean; truncated: boolean; stripeComplete: boolean | null }) {
  const summary = summarize(result.findings)
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          mode: result.mode,
          since: since.toISOString(),
          registryAvailable: result.registryAvailable,
          truncated: result.truncated,
          stripeComplete: result.stripeComplete,
          summary,
          findings: result.findings.map((f) => ({
            ...f,
            legKey: f.legKey ? f.legKey.replace(/^([a-z_]+):([^:]+)/, (_m, k: string, id: string) => `${k}:${maskId(id)}`) : null,
            transferIds: f.transferIds.map(maskId),
            detail: maskText(f.detail),
          })),
        },
        null,
        2
      )
    )
    return
  }
  console.log(`\nRapprochement des versements Affisell ↔ Stripe — mode ${result.mode}, depuis ${since.toISOString().slice(0, 10)}`)
  console.log(`  Registre PayoutLeg présent : ${result.registryAvailable ? "oui" : "non (migration non appliquée)"}`)
  if (result.truncated) console.log("  ATTENTION : lecture plafonnée — résultats partiels")
  if (result.stripeComplete === false) console.log("  ATTENTION : inventaire Stripe incomplet — aucune absence n'est affirmée")
  if (result.mode === "plan") console.log("  Stripe non lu (plan) : seules les incohérences internes sont listées")
  for (const [k, n] of Object.entries(summary)) if (n > 0) console.log(`  ${k.padEnd(34)} ${n}`)
  for (const f of result.findings.slice(0, 200)) {
    console.log(`  [${f.severity}] ${f.kind} ${f.transferIds.map(maskId).join(",")} ${maskText(f.detail)}`)
  }
  console.log("\n  Lecture seule : aucune correction n'est faite. Procédures : docs/PAYOUT-LEG-REGISTRY.md §8.\n")
}

runReadOnlyReport(
  {
    tables: ["PayoutLeg", "TransferAttempt", "MerchantPayoutLedger", "Order"],
    purpose: "rapprochement des versements avec les virements Stripe (lecture seule)",
  },
  async (tx) => {
    const facts = await collectPayoutReconciliationFacts(tx, { since })
    const stripe = execute ? { ...(await transferLister().listSince(since)), since } : null
    return {
      findings: reconcilePayouts({ stripe, legs: facts.legs, attempts: facts.attempts, ledger: facts.ledger, orderRefs: facts.orderRefs }),
      mode: execute ? "execute" : "plan",
      registryAvailable: facts.registryAvailable,
      truncated: facts.truncated,
      stripeComplete: stripe ? stripe.complete : null,
    }
  },
  print
).catch((e) => {
  console.error("report failed:", e instanceof Error ? e.message.slice(0, 200) : "error")
  process.exitCode = 1
})
